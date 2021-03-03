const LogLevel = ['debug', 'info', 'warn', 'error', 'silent'] as const;
export type LogLevel = typeof LogLevel[number];

export interface ILogger {
    debug(...messages: any[]): void;
    info(...messages: any[]): void;
    warn(...messages: any[]): void;
    error(...messages: any[]): void;
}

export class Logger {
    static Level: LogLevel = 'info';
    static logger?: ILogger;
    static debug(...messages: any[]) {
        if (LogLevel.indexOf(this.Level) <= 0) {
            this.logger?.debug(...messages);
        }
    }

    static info(...messages: any[]) {
        if (LogLevel.indexOf(this.Level) <= 1) {
            this.logger?.info(...messages);
        }
    }

    static warn(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 2) {
            this.logger?.warn(...messages);
        }
    }

    static error(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 3) {
            this.logger?.error(...messages);
        }
    }
}
