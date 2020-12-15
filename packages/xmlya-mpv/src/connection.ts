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

    constructor(private socket: Socket) {
        super(() => this.socket.removeAllListeners().destroy());
        this.socket.on('data', this.onMessage);
        this.socket.on('error', () => this.emit(ConnectionBuiltinEvents.Error));
        this.socket.on('close', () => {
            this.emit(ConnectionBuiltinEvents.Close);
        });
    }

    send = async <T>(command: string, ...params: any[]): Promise<T> => {
        const id = this.lastReqId++;
        const defer = new Defer<T>();
        Logger.debug('send command:', id, command, ...params);
        this.socket.write(
            JSON.stringify({ request_id: id, command: [command, ...params.filter((x) => x !== undefined)] }),
            (err) => {
                if (err) {
                    defer.reject(new SocketError(err));
                    return;
                }
                this.tasks.set(id, { defer, command });
            }
        );
        return await defer.wait();
    };

    observe(name: string) {
        const id = this.lastObsId++;
        this.socket.write(
            JSON.stringify({
                request_id: this.lastReqId++,
                command: ['observe_property', id, name],
            }),
            (err) => {
                Logger.debug('send err', err);
            }
        );
        return new Disposable(() => {
            this.socket.write(
                JSON.stringify({
                    request_id: this.lastReqId++,
                    command: ['unobserve_property', id],
                })
            );
        });
    }

    private onMessage = (chunk: Buffer) => {
        Logger.debug('receive socket:', chunk.toString('utf-8'));
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
                    if (error && error !== 'success') {
                        task.defer.reject(new CommandError(task.command, error));
                    } else {
                        task.defer.resolve(data);
                    }
                    return;
                }
                Logger.warn('unhandle message: ', raw);
            } else {
                this.emit(message.event, message);
            }
        }
    };
}
