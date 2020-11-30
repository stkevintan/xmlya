import net from 'net';
import cp from 'child_process';
import { Defer, EventEmitter, Disposable, memoAsync, noop, retryOnError, uniqArguments, getRandomId } from './common';
import { Callback, IEventReply, ILibMpvOptions, IReply, isResultReply } from './types';
import { Logger } from './logger';

// default Arguments
// --no-config Do not load default configuration files. This prevents loading of both the user-level and system-wide mpv.conf and input.conf files
// --idle always run in the background
// --really-quite  no console prompts. Buffer might overflow otherwise
// --msg-level=ipc=v  sets IPC socket related messages to verbose
// --no-video  no video will be displayed
// --no-audio-display  prevents album covers embedded in audio files from being displayed
const baseArguments = [
    '--no-config',
    '--idle',
    '--really-quiet',
    '--msg-level=ipc=v',
    '--no-video',
    '--no-audio-display',
];

export class LibMpv extends Disposable {
    private mpvd?: cp.ChildProcessWithoutNullStreams;
    private version: string;
    private replies$ = new EventEmitter<IReply>();
    private requestId = 0;
    private observerId = 0;

    getVersion() {
        return this.version;
    }

    onEvent(cb: Callback<IEventReply>) {
        return this.replies$.on((event) => {
            if (!isResultReply(event)) {
                cb(event);
            }
        });
    }

    get mpvBin(): string {
        return this.options.mpvBinary || 'mpv';
    }

    private readonly socketPath: string;

    private generateSocketPath() {
        const id = getRandomId('xxxxxx');
        return process.platform === 'win32' ? `\\\\.\\pipe\\mpvserver-${id}` : `/tmp/node-mpv-${id}.sock`;
    }

    private otherArgs() {
        const ret: string[] = [];
        const { volume, mute, speed } = this.options;
        if (typeof volume === 'number' && volume >= 0 && volume <= 100) {
            ret.push(`--volume=${volume}`);
        }

        if (typeof mute === 'boolean') {
            ret.push(`--mute=${mute ? 'yes' : 'no'}`);
        }

        if (typeof speed === 'number' && speed >= 0.01 && speed <= 100) {
            ret.push(`--speed=${speed}`);
        }
        return ret;
    }

    constructor(private options: ILibMpvOptions = {}) {
        super(() => {
            this.replies$.dispose();
            this.killMpv();
        });
        this.socketPath = this.options.socketPath || this.generateSocketPath();
        Logger.info('socket path at:', this.socketPath);
        this.version = this.checkVer();
    }

    private checkVer(): string {
        const stdout = cp.execSync(`${this.mpvBin} --version`, { encoding: 'utf-8' });
        // version maybe a release version or a git hash
        const match = stdout.match(/mpv\s+(\S+)/);
        if (!match?.[1]) {
            throw new Error('Unrecognize mpv version.');
        }
        const version = match[1];
        Logger.info('mpv version', version);
        // not a valid release number, just consider it is the latest.
        if (/[^\d.]/.test(version)) {
            return version;
        }
        const vers = version.split('.').map((x) => +x);
        if (vers[0] === 0 && vers[1] < 17) {
            throw new Error(`mpv version (${version}) is not supported, 0.17.0 or higher is required.`);
        }
        return version;
    }

    private async tryConnect(): Promise<net.Socket> {
        const defer = new Defer((e) => {
            Logger.error('connect failed', e);
            socket?.removeAllListeners();
            socket?.destroy();
        });

        Logger.info('try to connect');

        const socket = new net.Socket()
            .connect(this.socketPath)
            .once('ready', () => {
                Logger.debug('socket connected');
                defer.resolve();
            })
            .once('error', defer.reject);
        await defer.asPromise();
        return socket;
    }

    private killMpv() {
        Logger.debug('kill mpv');
        this.mpvd?.stdout.removeAllListeners();
        this.mpvd?.stderr.removeAllListeners();
        this.mpvd?.removeAllListeners();
        this.mpvd?.kill();
        this.lazyStart.flush();
    }

    private lazyStart = memoAsync(async () => {
        Logger.info('starting mpv');
        if (!this.version) {
            throw new Error(`mpv version (${this.version}) is not supported.`);
        }

        if (this.mpvd && !this.mpvd.killed) {
            this.mpvd.kill();
        }

        const combinedArguments = uniqArguments([
            `--input-ipc-server=${this.socketPath}`,
            ...baseArguments,
            ...this.otherArgs(),
            ...(this.options.args ?? []),
        ]);

        this.mpvd = cp.spawn(this.mpvBin, combinedArguments, {
            windowsHide: true,
        });

        this.mpvd.on('close', (code) => {
            Logger.warn(`mpv exit with code ${code}`);
            this.killMpv();
        });

        this.mpvd.stdout.on('data', (chunk) => Logger.debug('mpv stdout:', chunk.toString('utf8')));
        this.mpvd.stderr.on('data', (chunk) => Logger.debug('mpv stderr:', chunk.toString('utf8')));
        try {
            Logger.info('mpv start successfully');
            const socket = await retryOnError(() => this.tryConnect());
            // pipe data event to replies$
            return socket.on('data', (chunk) => {
                Logger.debug('receive socket:', chunk.toString('utf-8'));
                const raws = chunk
                    .toString('utf-8')
                    .split('\n')
                    .map((m) => m.trim())
                    .filter((m) => m);
                for (const raw of raws) {
                    const message = JSON.parse(raw);
                    this.replies$.fire(message);
                }
            });
        } catch (e) {
            // when connect failed, kill mpv
            this.killMpv();
            throw e;
        }
    });

    // DO NOT CALL `exec` in above methods
    async exec<T = any>(command: string, ...params: any[]): Promise<T> {
        const socket = await this.lazyStart();
        const request_id = this.requestId++;
        const defer = new Defer<T>(() => handle.dispose());
        const handle = this.replies$.on((reply) => {
            if (isResultReply(reply) && reply.request_id === request_id) {
                if (reply.error !== 'success') {
                    defer.reject(reply.error);
                } else {
                    defer.resolve(reply.data);
                    handle.dispose();
                }
            }
        });
        Logger.debug('send command:', command, ...params);
        socket.write(
            JSON.stringify({ command: [command, ...params.filter((x) => x !== undefined)], request_id }) + '\n',
            (err) => {
                if (err) {
                    defer.reject(err);
                }
            }
        );
        return await defer.asPromise();
    }

    //https://mpv.io/manual/stable/#properties
    async setProp(prop: string, value: any): Promise<void> {
        await this.exec('set_property', prop, value);
    }

    async getProp<T = any>(prop: string): Promise<T> {
        return await this.exec('get_property', prop);
    }

    async cycleProp(prop: string, dir?: 'up' | 'down'): Promise<void> {
        await this.exec('cycle', prop, dir);
    }

    async addProp(prop: string, value: number): Promise<void> {
        await this.exec('add', prop, value);
    }

    watchProp<T = any>(name: string, cb: Callback<T>): Disposable {
        const currentId = this.observerId++;
        const handle = Disposable.from(
            this.onEvent(({ event, name: eventName, data }) => {
                if (event === 'property-change' && name === eventName) {
                    cb(data);
                }
            }),
            { dispose: () => this.exec('unobserve_property', currentId).catch(noop) }
        );
        // do not await this command.
        this.exec('observe_property', currentId, name);
        return handle;
    }
}
