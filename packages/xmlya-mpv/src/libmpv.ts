import cp from 'child_process';
import { Disposable, retryOnError, uniqArguments, getRandomId } from './common';
import { Callback, IEventReply, ILibMpvOptions } from './types';
import { Logger } from './logger';
import { Connection, ConnectionBuiltinEvents } from './connection';

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
    private static generateSocketPath() {
        const id = getRandomId('xxxxxx');
        return process.platform === 'win32' ? `\\\\.\\pipe\\mpvserver-${id}` : `/tmp/node-mpv-${id}.sock`;
    }

    private static restArgs(options: ILibMpvOptions) {
        const ret: string[] = [];
        const { volume, mute, speed } = options;
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

    static async create(options: ILibMpvOptions = {}): Promise<LibMpv> {
        Logger.info('starting mpv');
        const binPath = options.mpvBinary?.trim() || 'mpv';

        const version = this.checkVer(binPath);
        if (!version) {
            throw new Error(`mpv version (${version}) is not supported.`);
        }
        const socketPath = options.socketPath ?? this.generateSocketPath();
        const combinedArguments = uniqArguments([
            `--input-ipc-server=${socketPath}`,
            ...baseArguments,
            ...this.restArgs(options),
            ...(options.args ?? []),
        ]);

        const mpvd = cp.spawn(binPath, combinedArguments, {
            windowsHide: true,
        });

        mpvd.stdout.on('data', (chunk) => Logger.debug('mpv stdout:', chunk.toString('utf8')));
        mpvd.stderr.on('data', (chunk) => Logger.debug('mpv stderr:', chunk.toString('utf8')));

        Logger.info('mpv start successfully');
        try {
            const conn = await retryOnError(() => Connection.establish(socketPath));
            // when socket closed, kill the mpv process.
            conn.once(ConnectionBuiltinEvents.Close, () => mpvd.kill());
            return new LibMpv(conn);
        } catch (e) {
            mpvd.kill();
            throw e;
        }
    }

    protected constructor(private conn: Connection) {
        super(() => conn.dispose());
    }

    private static checkVer(binPath: string): string {
        const stdout = cp.execSync(`'${binPath}' --version`, { encoding: 'utf-8' });
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

    // DO NOT CALL `exec` in above methods
    async exec<T = any>(command: string, ...params: any[]): Promise<T> {
        return await this.conn.send(command, ...params);
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
        const sub = this.conn.on('property-change', (reply: IEventReply) => {
            if (reply.name === name) {
                cb(reply.data);
            }
        });

        return Disposable.from(sub, this.conn.observe(name));
    }

    on(name: string, cb: Callback<any>): Disposable {
        return this.conn.on(name, cb);
    }

    once(name: string, cb: Callback<any>): Disposable {
        return this.conn.once(name, cb);
    }
}
