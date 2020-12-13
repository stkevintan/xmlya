export enum MpvErrorCode {
    SocketError,
    CommandError,
    OperationError,
}

export class MpvError extends Error {
    constructor(readonly code: MpvErrorCode, message?: string) {
        super(`MPV error code: ${code}: ${message}`);
    }
}
export class SocketError extends MpvError {
    constructor(event?: Error) {
        super(MpvErrorCode.SocketError, event?.message);
        // copy stack
        this.stack = event?.stack;
    }
}

export class CommandError extends MpvError {
    constructor(command: string, error?: string) {
        super(MpvErrorCode.CommandError, `(command: ${command} ${error})`);
    }
}

export class OperationError extends MpvError {
    constructor(message?: string) {
        super(MpvErrorCode.OperationError, message);
    }
}