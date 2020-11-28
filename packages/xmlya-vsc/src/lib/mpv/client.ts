import net from 'net';
import cp from 'child_process';
import { Disposable, EventEmitter, window } from 'vscode';
import { Context } from '../context';
import { Callback, Defer, memoAsync, uniq } from '../common';
import { Logger } from '../logger';
import { Socket } from 'dgram';

export interface IMpvOptions {
    socketPath?: string;
    args?: string[];
    mpvBinary?: string;
}
const UNKNOWN = 'UNKNOWN';

export enum MpvStatus {
    missing,
    exited,
    checked,
    starting,
    startFailed,
    connecting,
    connectFailed,
    idle,
    loading,
    playing,
    paused,
}

// https://mpv.io/manual/stable/#list-of-events
export interface IEventReply {
    event: string;
    error?: string;
    [key: string]: any;
}

export interface IResultReply {
    error?: string;
    // plain object
    data: any;
    request_id: number;
}

export type IReply = IResultReply | IEventReply;
export function isResultReply(reply: IReply): reply is IResultReply {
    return 'request_id' in reply;
}

const defaultOptions: Partial<IMpvOptions> = {
    socketPath: process.platform === 'win32' ? '\\\\.\\pipe\\mpvserver' : '/tmp/node-mpv.sock',
};

// the name of the ipc command was changed in mpv version 0.17.0 to '--input-ipc-server'
function getIpcCommand(version: string): string {
    if (version === UNKNOWN) return '--input-ipc-server';
    const vers = version.split('.').map((x) => +x);
    if (vers[0] > 0 || vers[1] >= 17) return '--input-ipc-server';
    return '--input-unix-socket';
}

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
    '--volume=100',
];

export class MpvClient extends Disposable {
    private options: IMpvOptions;
    private mpvd?: cp.ChildProcessWithoutNullStreams;
    protected ctx: Context;
    protected version: string;
    protected replies$ = new EventEmitter<IReply>();
    private socket?: net.Socket;
    private requestId = 0;
    private observerId = 0;

    protected get status(): MpvStatus | undefined {
        return this.ctx.getContext('mpv.status');
    }

    protected set status(status: MpvStatus | undefined) {
        if (status !== undefined) {
            this.ctx.setContext('mpv.status', status);
        }
    }

    private get mpvBin() {
        return this.options.mpvBinary ?? 'mpv';
    }

    getStatus() {
        return this.status;
    }

    constructor(options?: IMpvOptions) {
        super(() => {
            this.socket?.removeAllListeners();
            this.socket?.destroy();
            this.mpvd?.removeAllListeners();
            this.mpvd?.kill();
            this.replies$.dispose();
            this.syncDisposable?.dispose();
        });
        this.options = { ...defaultOptions, ...options };
        this.ctx = new Context();
        this.version = this.checkVer();
    }

    private checkVer(): string {
        let ok = true;
        try {
            const stdout = cp.execSync(`${this.mpvBin} --version`, { encoding: 'utf-8' });
            if (/UNKNOWN/.test(stdout)) {
                return UNKNOWN;
            }
            const ret = stdout.match(/mpv\s+((\d+\.?)+)/);
            const version = ret?.[1];
            if (version === undefined || version === null) {
                throw new Error('version parse failed');
            }
            return version;
        } catch (e) {
            ok = false;
            this.handleMpvMissing();
            throw e;
        } finally {
            this.status = ok ? MpvStatus.checked : MpvStatus.missing;
        }
    }

    private handleMpvMissing() {
        window.showErrorMessage(
            "mpv binary is not found. please install mpv or provide a correct mpv binary path.\n offical doc: 'https://mpv.io/installation/' "
        );
    }

    // private async checkMpvSocketOpened(): Promise<boolean> {
    //     const socket = new net.Socket();
    //     const handle = socket.connect(this.options.socketPath!, () => {
    //         socket.write(
    //             JSON.stringify({
    //                 command: ['get_property', 'mpv-version'],
    //             }) + '\n'
    //         );
    //     });
    //     const defer = new Defer<boolean>();
    //     handle.on('data', (chunk) => {
    //         try {
    //             const res = JSON.parse(chunk.toString());
    //             defer.resolve('data' in res && 'error' in res && res.error === 'success');
    //         } catch {
    //             defer.resolve(false);
    //         }
    //     });
    //     handle.on('error', () => defer.resolve(false));

    //     const ret = await defer.asPromise();
    //     handle.destroy();
    //     return ret;
    // }

    private async connect(): Promise<void> {
        this.status = MpvStatus.connecting;

        this.socket?.removeAllListeners();
        this.socket?.destroy();
        const defer = new Defer(5 * 1000, () => {
            handle.dispose();
            this.status = MpvStatus.connectFailed;
        });

        const handle = this.replies$.event((reply) => {
            if (isResultReply(reply)) return;
            if (
                // idle event is deprecated.
                reply.event === 'idle' ||
                reply.event === 'file-loaded'
            ) {
                handle.dispose();
                defer.resolve();
            }
        });

        this.socket = new net.Socket()
            .connect(this.options.socketPath!)
            .on('data', this.piepToReplies)
            .once('error', defer.reject);

        await defer.asPromise();
    }

    private piepToReplies(chunk: Buffer) {
        const raws = chunk
            .toString('utf-8')
            .split('\n')
            .map((m) => m.trim())
            .filter((m) => m);
        for (const raw of raws) {
            const message = JSON.parse(raw);
            this.replies$.fire(message);
        }
    }

    private async syncStatus() {
        const all = await Promise.allSettled([
            this.onPropertyChange<boolean>('pause', (pause) => {
                if (pause && this.status === MpvStatus.playing) {
                    this.status = MpvStatus.paused;
                }
                if (!pause) {
                    this.status = MpvStatus.playing;
                }
            }),

            this.onPropertyChange<boolean>('idle-active', (active) => {
                if (active) {
                    this.status = MpvStatus.idle;
                }
            }),

            this.onPropertyChange<boolean>('playback-abort', (stopped) => {
                if (stopped) {
                    this.status = MpvStatus.idle;
                }
            }),
        ]);
        return Disposable.from(
            ...all.filter((v): v is PromiseFulfilledResult<Disposable> => v.status === 'fulfilled').map((v) => v.value)
        );
    }

    // private onMpvExit(code: number) {
    //     this.mpvd?.stdout.removeAllListeners();
    //     this.mpvd?.stderr.removeAllListeners();
    //     this.mpvd?.removeAllListeners();
    //     Logger.debug(`mpv exit with code: ${code}`);
    //     switch (code) {
    //         case 0:
    //             this.status = MpvStatus.quitted;
    //             break;
    //         default:
    //             this.status = MpvStatus.crashed;
    //     }
    //     Logger.debug(`restart mpv`);
    //     this.mpvd = undefined;
    //     this.lazyStart(true);
    // }

    private syncDisposable?: Disposable;
    private lazyStart = memoAsync(
        async () => {
            Logger.assert(this.version, 'mpv is not available!');

            this.status = MpvStatus.starting;

            const combinedArguments = uniq([
                ...baseArguments,
                `${getIpcCommand(this.version)}=${this.options.socketPath}`,
                ...(this.options.args ?? []),
            ]);

            this.mpvd = cp.spawn(this.mpvBin, combinedArguments, {
                windowsHide: true,
            });

            this.mpvd.on('close', (code) => {
                Logger.debug(`mpv exit with code ${code}`);
                this.status = MpvStatus.exited;
            });

            const defer = new Defer<void>(() => (this.status = MpvStatus.startFailed));

            const check = (chunk: Buffer | string) => {
                const text = chunk.toString();
                let unbind = false;
                if (/Listening to IPC (socket|pipe)/.test(text)) {
                    unbind = true;
                    defer.resolve();
                } else if (/Could not bind IPC (socket|pipe)/.test(text)) {
                    unbind = true;
                    defer.reject('Could not bind IPC');
                }
                if (unbind) {
                    this.mpvd?.stdout.off('data', check);
                    this.mpvd?.stderr.off('data', check);
                }
            };
            this.mpvd.stdout.on('data', check);
            this.mpvd.stderr.on('data', check);
            // this.mpvd.unref();
            await defer.asPromise();

            await this.connect();

            this.syncDisposable = await this.syncStatus();
        },
        () => {
            if (this.mpvd && this.mpvd.exitCode !== null) {
                this.mpvd.stdout.removeAllListeners();
                this.mpvd.stderr.removeAllListeners();
                this.mpvd.removeAllListeners();
                this.syncDisposable?.dispose();
                return true;
            }
            return false;
        }
    );

    // DO NOT CALL `exec` in above methods
    protected async exec<T = any>(command: string, ...params: any[]): Promise<T> {
        await this.lazyStart();
        const request_id = this.requestId++;
        const defer = new Defer<T>();
        const handle = this.replies$.event((reply) => {
            if (isResultReply(reply) && reply.request_id === request_id) {
                handle.dispose();
                if (reply.error !== 'success') {
                    defer.reject(new Error(reply.error));
                } else {
                    defer.resolve(reply.data);
                }
            }
        });
        Logger.assert(this.socket, 'socket is currently null');
        this.socket.write(
            JSON.stringify({ command: [command, ...params.filter((x) => x)], request_id }) + '\n',
            (err) => {
                if (err) {
                    defer.reject(err);
                }
            }
        );
        return await defer.asPromise();
    }

    //https://mpv.io/manual/stable/#properties
    protected async setProp(prop: string, value: any): Promise<void> {
        await this.exec('set-property', prop, value);
    }

    protected async getProp<T = any>(prop: string): Promise<T> {
        return await this.exec('get-property', prop);
    }

    protected async cycleProp(prop: string, dir?: 'up' | 'down'): Promise<void> {
        await this.exec('cycle', prop, dir);
    }

    protected async addProp(prop: string, value: number): Promise<void> {
        await this.exec('add', prop, value);
    }

    async onPropertyChange<T>(name: string, cb: Callback<T>): Promise<Disposable> {
        const id = this.observerId++;
        await this.exec('observe_property', id, name);
        const disposable = this.replies$.event((reply) => {
            if (isResultReply(reply)) return;
            if (reply.event === 'property-change' && reply.id === id) {
                cb(reply.data);
            }
        });
        return Disposable.from(disposable, {
            dispose: () => {
                this.exec('unobserve_property', id).catch(noop);
            },
        });
    }
}
