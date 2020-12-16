import { Socket } from 'net';
import { Defer, Disposable, EventEmitter } from './common';
import { CommandError, SocketError } from './error';
import { Logger } from './logger';
import { IReply, isResultReply } from './types';

export interface ITaskContext {
    defer: Defer<any>;
    command: string;
}

export const ConnectionBuiltinEvents = {
    Close: Symbol('Connection.Close'),
    Error: Symbol('Connection.Error'),
};

export class Connection extends EventEmitter {
    // starts from 1 since 0 is a falsy value.
    private lastReqId = 1;
    private lastObsId = 1;

    private tasks = new Map<number, ITaskContext>();

    static async establish(socketPath: string): Promise<Connection> {
        const defer = new Defer();
        Logger.info('try to connect the mpv socket server...');
        const socket = new Socket()
            .connect(socketPath)
            .once('ready', () => {
                Logger.debug('socket connected');
                defer.resolve();
            })
            .once('error', (err) => {
                socket.destroy();
                defer.reject(new SocketError(err));
            });
        await defer.wait();
        return new Connection(socket);
    }

    constructor(private socket: Socket) {
        super(() => this.socket.removeAllListeners().destroy());
        this.socket.on('data', this.onMessage);
        this.socket.on('error', () => this.emit(ConnectionBuiltinEvents.Error));
        this.socket.on('close', () => {
            this.emit(ConnectionBuiltinEvents.Close);
        });
    }

    send = async <T>(command: string, ...params: any[]): Promise<T> => {
        const id = await this.rawSend({ command: [command, ...params.filter((x) => x !== undefined)] });
        // wait for the result.
        const defer = new Defer<T>();
        this.tasks.set(id, { defer, command });
        return await defer.wait();
    };

    private rawSend = async (obj: Record<string, any>) => {
        const id = this.lastReqId++;
        Logger.debug('send command:', id, obj.command);
        const defer = new Defer<number>();
        this.socket.write(JSON.stringify({ ...obj, request_id: id }) + '\n', (err) => {
            if (err) {
                defer.reject(new SocketError(err));
            } else {
                defer.resolve(id);
            }
        });
        return await defer.wait();
    };

    observe(name: string) {
        const id = this.lastObsId++;
        this.rawSend({
            command: ['observe_property', id, name],
        }).catch((err) => {
            Logger.error('observe failed on property', name, err);
        });

        return new Disposable(() => {
            this.rawSend({
                command: ['unobserve_property', id],
            });
        });
    }

    private onMessage = (chunk: Buffer) => {
        const raws = chunk
            .toString('utf-8')
            .split('\n')
            .map((m) => m.trim())
            .filter((m) => m);
        for (const raw of raws) {
            const message = JSON.parse(raw) as IReply;
            if (isResultReply(message)) {
                const { request_id, error, data } = message;
                const task = this.tasks.get(request_id);
                this.tasks.delete(request_id);
                if (task) {
                    Logger.info('receive command reply:', message);
                    if (error && error !== 'success') {
                        task.defer.reject(new CommandError(task.command, error));
                    } else {
                        task.defer.resolve(data);
                    }
                } else {
                    Logger.warn('unhandle command reply: ', raw);
                }
            } else {
                Logger.info('receive event: ', message);
                this.emit(message.event, message);
            }
        }
    };
}
