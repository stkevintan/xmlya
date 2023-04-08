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

export function omit<T extends Record<any, any>, K extends Array<keyof T>>(obj: T, ...keys: K): Omit<T, K[number]> {
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
    return x && typeof x === 'object' && 'then' in x;
}

export function isNil<T>(x: T | undefined | null): x is undefined | null {
    return x === null || x === undefined;
}

export function isntNil<T>(x: T | undefined | null): x is T {
    return !isNil(x);
}

export function omitNillKeys<T extends Record<any, any>>(obj: T): Partial<T> {
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
    // s, m, h
    for (let i = 0; i < 3; i++) {
        segArr.push(sec % 60);
        sec = Math.floor(sec / 60);
    }

    const s = `${100 + segArr[0]}`.substr(1);
    const m = `${100 + segArr[1]}`.substr(1);
    const h = segArr[2];

    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
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
    void loop();
    return { dispose: () => (working = false) };
}

export function formatSize(bytes: number): string {
    let remains = bytes;
    const units = ['B', 'KB', 'MB', 'GB'];
    const ret: string[] = [];
    for (const u of units) {
        ret.push(`${remains % 1024}${u}`);
        remains = Math.floor(remains / 1024);
        if (remains === 0) {
            break;
        }
    }
    return ret.reverse().join(' ');
}

export function normError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return `${err}`;
}