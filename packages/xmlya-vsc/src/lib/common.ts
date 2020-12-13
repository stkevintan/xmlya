import { spawn } from 'child_process';
import { Disposable } from 'vscode';
import { IndentChars, NA } from './constant';

export type PromiseOrNot<T> = T | Promise<T>;
export type Func<T extends Array<any>, R> = (...args: T) => R;
export type Action<R = void> = Func<[], R>;
export type Callback<T = void> = Func<[T], void>;
export type Lazy<T> = () => T;

export function isLazy<T>(x: T | Lazy<T>): x is Lazy<T> {
    return typeof x === 'function';
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

export function isNil<T>(x: T | undefined | null): x is undefined | null {
    return x === null || x === undefined;
}

export function isntNil<T>(x: T | undefined | null): x is T {
    return !isNil(x);
}

export function omitNillKeys<T>(obj: T): Partial<T> {
    const keys = Object.keys(obj) as (keyof T)[];
    const copy = {} as Partial<T>;
    for (const key of keys) {
        if (!isNil(obj[key])) {
            copy[key] = obj[key];
        }
    }
    return copy;
}

export function ellipsis(text: string, len: number) {
    if (text.length <= len) return text;
    return `${text.slice(0, len).trim()}...`;
}

export function formatDuration(sec?: number): string {
    if (sec === undefined) return NA;
    const segArr: number[] = [];
    for (let i = 0; i < 2; i++) {
        segArr.push(sec % 60);
        sec = Math.floor(sec / 60);
    }

    const times: string[] = [];
    for (let i = 1; i >= 0; i--) {
        if (segArr[i] === 0) continue;
        // left pad
        times.push(`${segArr[i] + 100}`.substr(1));
    }
    return times.join(':');
}

export function openUrl(url: string): void {
    let command = '';
    switch (process.platform) {
        case 'linux':
            command = `xdg-open`;
            break;
        case 'darwin':
            command = `open`;
            break;
        case 'win32':
            command = `cmd /c start`;
            break;
        default:
            throw new Error(`Platform ${process.platform} is not supported.`);
    }
    spawn(command, [url], {
        detached: true,
    }).unref();
}

export async function delay(ms: number) {
    return await new Promise((res) => setTimeout(res, ms));
}

export function asyncInterval(cb: Action<Promise<void>>, ms: number): Disposable {
    let working = true;
    const loop = async () => {
        while (working) {
            await cb();
            await delay(ms);
        }
    };
    loop();
    return { dispose: () => (working = false) };
}
