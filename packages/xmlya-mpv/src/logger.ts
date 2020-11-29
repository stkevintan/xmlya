import { noop } from "./common";

const LogLevel = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = typeof LogLevel[number];

function formatPrefix(logLevel: LogLevel) {
    return `[${new Date().toISOString()}] [${logLevel.toUpperCase()}] xmlya-mpv - `;
}

export class Logger {
    static Level: LogLevel = 'info';
    static logger?: (...messages: any) => void;

    static debug(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 0) {
            this.logger?.(formatPrefix('debug'), ...messages);
        }
    }

    static info(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 1) {
            this.logger?.(formatPrefix('info'), ...messages);
        }
    }

    static warn(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 2) {
            this.logger?.(formatPrefix('warn'), ...messages);
        }
    }

    static error(...messages: any) {
        if (LogLevel.indexOf(this.Level) <= 3) {
            this.logger?.(formatPrefix('error'), ...messages);
        }
    }
}
