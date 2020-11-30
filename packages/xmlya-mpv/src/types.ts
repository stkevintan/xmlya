export type Callback<T> = (x: T) => void;

export interface ILibMpvOptions {
    socketPath?: string;
    args?: string[];
    mpvBinary?: string;
    /**
     * start volume, 0 - 100
     */
    volume?: number;
    /**
     * start speed, 0.01 - 100
     */
    speed?: number;
    /**
     * if start with mute
     */
    mute?: boolean;
}

// https://mpv.io/manual/stable/#list-of-events
export interface IEventReply {
    event: string;
    error?: string;
    [key: string]: any;
}

export interface IResultReply {
    error?: string;
    // plain object
    data: any;
    request_id: number;
}

export type IReply = IResultReply | IEventReply;

export function isResultReply(reply: IReply): reply is IResultReply {
    return 'request_id' in reply;
}
