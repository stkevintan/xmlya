import * as vscode from 'vscode';

export enum LogLevel {
    debug,
    info,
    warn,
    error,
    slient,
}

function formatPrefix(componentName: string, logLevel: LogLevel) {
    return `[${new Date().toISOString()}] [${LogLevel[logLevel].toUpperCase()}] ${componentName} - `;
}

export class Notification {
    static assert(x: any, message?: string): asserts x {
        if (x === null || x === undefined) {
            Notification.throw(message);
        }
    }

    static assertTrue(x: boolean, message?: string): asserts x is true {
        if (!x) {
            Notification.throw(message);
        }
    }

    static throw(error?: string | Error): never {
        const message = !error
            ? ''
            : typeof error === 'string'
            ? error
            : error.message ?? Object.prototype.toString.call(error);

        void vscode.window.showErrorMessage(message);
        throw error instanceof Error ? error : new Error(message);
    }
}
export class Logger {
    static Level: LogLevel = LogLevel.debug;

    static Channel: vscode.OutputChannel | null;

    constructor(private componentName: string) {}

    private log(logLevel: LogLevel, messages: any[] = []) {
        if (Logger.Level <= logLevel) {
            Logger.Channel?.appendLine(formatPrefix(this.componentName, logLevel) + messages.join(' '));
        }
    }

    debug(...messages: any[]): void {
        this.log(LogLevel.debug, messages);
    }

    info(...messages: any[]): void {
        this.log(LogLevel.info, messages);
    }

    warn(...messages: any[]): void {
        this.log(LogLevel.warn, messages);
    }

    error(...messages: any[]): void {
        this.log(LogLevel.error, messages);
    }
}
