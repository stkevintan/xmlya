import events from 'events';
import { Socket } from 'net';
import { Logger } from './logger';
import { Callback } from './types';
export interface IDisposable {
    dispose: () => void;
}
export class Disposable implements IDisposable {
    private isDisposed = false;
    constructor(private callonDispose: () => void) {}
    readonly dispose = () => {
        if (this.isDisposed) return;
        this.isDisposed = true;
        this.callonDispose();
    };

    static from = (...disposables: IDisposable[]): Disposable =>
        new Disposable(() => {
            const errors: any[] = [];
            for (const disposable of disposables) {
                try {
                    disposable.dispose();
                } catch (err) {
                    errors.push(err);
                }
            }
            if (errors.length === 1) {
                throw errors[0];
            }
            if (errors.length > 1) {
                throw new Error(errors.join('\n'));
            }
        });
}

export class Defer<T = void> {
    private _resolve?: (value: T) => void;
    private _reject?: (reason?: any) => void;
    private _promise: Promise<T>;
    private tapOnError?: (err: any) => void;
    private timeout?: number;
    private token?: NodeJS.Timeout;

    constructor(tapOnError?: (err: any) => void);
    constructor(timeout?: number, tapOnError?: (err: any) => void);
    constructor(arg1?: any, arg2?: any) {
        if (typeof arg1 === 'number') {
            this.timeout = arg1;
            this.tapOnError = arg2;
        } else if (typeof arg1 === 'function') {
            this.tapOnError = arg1;
        }

        this._promise = new Promise<T>((res, rej) => {
            this._resolve = res;
            this._reject = rej;
            if (this.timeout) {
                this.token = setTimeout(() => rej(new Error('operation timeout')), this.timeout);
            }
        });
    }

    resolve = (value: T) => {
        if (this.token !== undefined) {
            clearTimeout(this.token);
        }
        this._resolve?.(value);
    };

    reject = (reason?: any) => {
        if (this.token !== undefined) {
            clearTimeout(this.token);
        }
        try {
            this.tapOnError?.(reason);
        } finally {
            this._reject?.(reason);
        }
    };

    wait() {
        return this._promise;
    }
}

export class EventEmitter extends Disposable {
    private event = new events.EventEmitter();

    constructor(callOnDispose?: () => void) {
        super(() => {
            this.event.removeAllListeners();
            callOnDispose?.();
        });
        this.event.setMaxListeners(0);
    }

    on(name: string | symbol, callback: Callback<any>): Disposable {
        this.event.on(name, callback);
        return new Disposable(() => this.event.off(name, callback));
    }

    once(name: string | symbol, callback: Callback<any>): Disposable {
        this.event.once(name, callback);
        return new Disposable(() => this.event.off(name, callback));
    }

    emit(name: string | symbol, value?: any): boolean {
        return this.event.emit(name, value);
    }
}

const voidSym = Symbol('void');
export const memoAsync = <T extends IDisposable>(fn: () => Promise<T>) => {
    let cache: any = voidSym;
    const cachedFn = (): Promise<T> => {
        return cache === voidSym
            ? (cache = fn().catch((e) => {
                  //when error happens, auto clear cache.
                  cache = voidSym;
                  return Promise.reject(e);
              }))
            : cache;
    };
    cachedFn.flush = () => {
        if (cache !== voidSym) {
            cache.then((ret: IDisposable) => ret?.dispose());
        }
        cache = voidSym;
    };
    return cachedFn;
};

export function uniqArguments(args: string[]): string[] {
    const ret: string[] = [];
    const set = new Set<string>();
    for (const arg of args) {
        const argName = arg.replace(/=.*$/, '');
        if (set.has(argName)) {
            Logger.warn('duplicated arguments', arg, 'ignored');
            continue;
        }
        set.add(argName);
        ret.push(arg);
    }
    return ret;
}

export const noop = () => {};

export const delay = (ms: number) => new Promise<void>((res) => setTimeout(() => res(), ms));

export const retryOnError = async <T>(fn: () => Promise<T>, timeout = 8 * 1000): Promise<T> => {
    const current = Date.now();
    while (true) {
        try {
            return await fn();
        } catch (e) {
            if (Date.now() - current > timeout) {
                throw e;
            }
            Logger.debug('run failed, retry ...');
            await delay(1000);
        }
    }
};

const table = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const getRandomId = (template: string) => {
    return template.replace(/x/g, () => {
        const index = Math.floor(Math.random() * table.length);
        return table[index];
    });
};
