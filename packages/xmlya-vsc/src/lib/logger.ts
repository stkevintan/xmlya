import * as vscode from 'vscode';

export enum LogLevel {
    debug,
    info,
    warn,
    error,
    slient,
}

export class Logger {
    static Level: LogLevel = LogLevel.debug;

    static assert(x: any, message?: string): asserts x {
        if (x === null || x === undefined) {
            Logger.error(message);
        }
    }

    static assertTrue(x: boolean, message?: string): asserts x is true {
        if (!x) {
            Logger.error(message);
        }
    }

    static debug = (message: string): void => {
        if (Logger.Level <= LogLevel.debug) {
            vscode.window.showInformationMessage(message);
        }
    };

    static info = (message: string): void => {
        if (Logger.Level <= LogLevel.info) {
            vscode.window.showInformationMessage(message);
        }
    };

    static warn = (message: string): void => {
        if (Logger.Level <= LogLevel.warn) {
            vscode.window.showWarningMessage(message);
        }
    };

    static error = (error?: string | Error): never => {
        const message = !error
            ? ''
            : typeof error === 'string'
            ? error
            : error.message ?? Object.prototype.toString.call(error);

        if (message && Logger.Level <= LogLevel.error) {
            vscode.window.showErrorMessage(message);
        }
        throw error instanceof Error ? error : new Error(message);
    };
}
