import { Disposable, EventEmitter } from 'vscode';

function checkKey(key: string) {
    if (!key) throw new Error('key should not be empty or null.');
    if (/[^\w.]/.test(key)) throw new Error(`key "${key}" is invalid, only [a-zA-Z_.] are allowed`);
}
export class Context {
    private store: Record<string, any> = {};
    private event = new EventEmitter<string[]>();

    constructor(ctx?: Record<string, any>) {
        if (ctx) {
            this.setContexts(ctx);
        }
    }

    setContexts(ctx: Record<string, any>) {
        const keys = Object.keys(ctx);
        keys.forEach(checkKey);
        for (const key of keys) {
            this.store[key] = ctx[key];
        }
        this.event.fire(Object.keys(ctx));
    }

    setContext(key: string, value: any) {
        checkKey(key);
        this.store[key] = value;
        this.event.fire([key]);
    }

    getContext<T = unknown>(key: string): T | undefined {
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

    removeContext(key: string) {
        delete this.store[key];
        this.event.fire([key]);
    }

    onDidContextChange(cb: (changedKeys: string[]) => void): Disposable {
        return this.event.event(cb);
    }

    dispose() {
        this.event.dispose();
    }
}
