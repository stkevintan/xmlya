import { debounce } from 'ts-debounce';
import { Disposable, EventEmitter } from 'vscode';

function checkKey(key: string) {
    if (!key) throw new Error('key should not be empty or null.');
    if (/[^\w.]/.test(key)) throw new Error(`key "${key}" is invalid, only [a-zA-Z_.] are allowed`);
}
export class RuntimeContext {
    private store: Record<string, any> = {};
    private event = new EventEmitter<string[]>();

    constructor(ctx?: Record<string, any>) {
        if (ctx) {
            this.assign(ctx);
        }
    }

    private assign(ctx: Record<string, any>) {
        const keys = Object.keys(ctx);
        // check key first. to avoid transaction problem.
        keys.forEach(checkKey);
        for (const key of keys) {
            this.store[key] = ctx[key];
        }
    }

    private fire(keys: string[] | string) {
        if (typeof keys === 'string') {
            this.event.fire([keys]);
        } else if (keys.length > 0) {
            this.event.fire(keys);
        }
    }

    set(ctx: Record<string, any>): void;
    set(key: string, value: any): void;
    set(keyOrCtx: Record<string, any> | string, value?: any): void {
        if (typeof keyOrCtx === 'string') {
            const key = keyOrCtx;
            checkKey(key);
            this.store[key] = value;
            this.fire(key);
        } else {
            const ctx = keyOrCtx;
            const keys = Object.keys(ctx);
            // check key first. to avoid transaction problem.
            keys.forEach(checkKey);
            for (const key of keys) {
                this.store[key] = ctx[key];
            }
            this.fire(Object.keys(ctx));
        }
    }

    get<T = unknown>(key: string): T | undefined {
        return this.store[key];
    }

    // TODO: need a more normal implement
    testExpr(str: string): boolean {
        return eval(str.replace(/[\w.]+/g, (expr) => (this.store[expr] ? 'true' : 'false')));
        // if (this.store[str]) return !!this.store[str];
        // if (str.startsWith('!')) {
        //     const expr = str.substr(1);
        //     return !this.store[expr];
        // }
        // return false;
    }

    delete(key: string) {
        delete this.store[key];
        this.fire([key]);
    }

    onChange(cb: (changedKeys: string[]) => void, debounceTime?: number): Disposable {
        if (debounceTime) {
            return this.event.event(debounce(cb, debounceTime));
        }
        return this.event.event(cb);
    }

    dispose() {
        this.event.dispose();
    }
}
