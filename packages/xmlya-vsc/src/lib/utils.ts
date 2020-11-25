import { IndentChars } from "./constant";
import { PromiseOrNot } from "./types";

export function leftPad(text: string | undefined, length: number) {
    if (!text) {
        return text;
    }
    return Array.from({ length }, () => IndentChars).join('') + text;
}

export function isPromise<T>(x: PromiseOrNot<T>): x is Promise<T> {
    return x && 'then' in x;
} 