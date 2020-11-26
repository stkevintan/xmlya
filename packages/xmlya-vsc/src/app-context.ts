import { Disposable, EventEmitter } from 'vscode';

export interface IContextChangeEvent {
    type: 'set' | 'del';
    key: string;
    value?: any;
}

export class AppContext {
    private static store: Record<string, any> = {};
    private static event = new EventEmitter<IContextChangeEvent>();
    static setContext(key: string, value: any) {
        this.store[key] = value;
        this.event.fire({ type: 'set', key, value });
    }

    static getContext<T = unknown>(key: string): T | undefined {
        return this.store[key];
    }

    static removeContext(key: string) {
        delete this.store[key];
        this.event.fire({ type: 'del', key });
    }

    static onDidContextChange(cb: (e: IContextChangeEvent) => void): Disposable {
        return this.event.event(cb);
    }
    static dispose() {
        this.event.dispose();
    }
}
