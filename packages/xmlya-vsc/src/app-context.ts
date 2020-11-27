import { Disposable, EventEmitter } from 'vscode';

export class AppContext {
    private static store: Record<string, any> = {};
    private static event = new EventEmitter<void>();
    static setContexts(ctx: Record<string, any>) {
        Object.assign(this.store, ctx);
        this.event.fire();
    }
    static setContext(key: string, value: any) {
        this.store[key] = value;
        this.event.fire();
    }

    static getContext<T = unknown>(key: string): T | undefined {
        return this.store[key];
    }

    // TODO: need a more normal implement
    static testExpr(str: string): boolean {
        if (this.store[str]) return !!this.store[str];
        if (str.startsWith('!')) {
            const expr = str.substr(1);
            return !this.store[expr];
        }
        return false;
    }

    static removeContext(key: string) {
        delete this.store[key];
        this.event.fire();
    }

    static onDidContextChange(cb: () => void): Disposable {
        return this.event.event(cb);
    }
    static dispose() {
        this.event.dispose();
    }
}
