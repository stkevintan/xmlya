import { IndentChars } from './constant';

export type PromiseOrNot<T> = T | Promise<T>;
export type Func<T extends Array<any>, R> = (...args: T) => R;
export type Action<R = void> = Func<[], R>;
export type Callback<T = void> = Func<[T], void>;
export type Lazy<T> = () => T;

export function isLazy<T>(x: T | Lazy<T>): x is Lazy<T> {
    return typeof x === 'function';
}

export function uniq<T>(arr: T[]): T[] {
    return [...new Set(arr)];
}

export const noop = () => {};
export function omit<T, K extends Array<keyof T>>(obj: T, ...keys: K): Omit<T, K[number]> {
    return Object.entries(obj).reduce((ret, [key, value]: any) => {
        if (!keys.includes(key)) ret[key] = value;
        return ret;
    }, {} as any);
}

export function leftPad(text: string | undefined, length: number) {
    if (!text) {
        return text;
    }
    return Array.from({ length }, () => IndentChars).join('') + text;
}

export function isPromise<T>(x: PromiseOrNot<T>): x is Promise<T> {
    return x && 'then' in x;
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

    asPromise() {
        return this._promise;
    }
}

const voidSym = Symbol('void');
export const memoAsync = <T>(fn: () => Promise<T>, flush?: () => boolean) => {
    let cache: any = voidSym;
    return (force?: boolean): Promise<T> => {
        if (force) cache = voidSym;
        if (flush?.()) cache = voidSym;
        return cache === voidSym ? (cache = fn()) : cache;
    };
};
