import { IndentChars } from './constant';

export type PromiseOrNot<T> = T | Promise<T>;
export type Func<T extends Array<any>, R> = (...args: T) => R;
export type Action<R = void> = Func<[], R>;


export function omit<T, K extends Array<keyof T>>(obj: T, ...keys: K): Omit<T, K[number]> {
    return Object.entries(obj).reduce((ret, [key, value]: any)=> {
        if(!keys.includes(key)) ret[key] = value;
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
