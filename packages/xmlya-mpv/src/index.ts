import path from 'path';
import { Defer, Disposable } from './common';
import { OperationError } from './error';
import { LibMpv } from './libmpv';
import { Logger, LogLevel } from './logger';
import { ILibMpvOptions } from './types';

export interface IMpvOptions extends ILibMpvOptions {
    logger?: (...args: any) => void;
    /**
     * default to info
     */
    logLevel?: LogLevel;
}

export class Mpv extends Disposable {
    static async create(options: IMpvOptions = {}): Promise<Mpv> {
        Logger.logger = options.logger;
        Logger.Level = options.logLevel ?? 'info';
        return new Mpv(await LibMpv.create(options));
    }

    constructor(private lib: LibMpv) {
        super(() => lib.dispose());
    }
    /**
     * load source in timeout millionseconds
     * @param source
     * @param timeout
     */
    async play(): Promise<void>;
    async play(source: string): Promise<void>;
    async play(source?: string): Promise<void> {
        if (source === undefined) {
            return await this.resume();
        }
        if (!source.startsWith('http')) {
            source = path.resolve(source);
        }
        await this.lib.exec('loadfile', source);
        // wait for the start-file event
        await new Promise((res) => this.lib.on('start-file', res));
        // determine the load result.
        const defer = new Defer(() => Disposable.from(...handlers).dispose());
        const handlers: Disposable[] = [
            this.lib.once('file-loaded', defer.resolve),
            this.lib.once('end-file', () => defer.reject(new OperationError(`file load error`))),
        ];
        await defer.wait();
    }

    async pause(): Promise<void> {
        await this.lib.setProp('pause', true);
    }

    async resume(): Promise<void> {
        await this.lib.setProp('pause', false);
    }

    async togglePause(pause?: boolean): Promise<void> {
        if (pause === true) await this.pause();
        else if (pause === false) await this.resume();
        else await this.lib.cycleProp('pause');
    }

    async stop(): Promise<void> {
        await this.lib.exec('stop');
    }

    /**
     * get the speed
     */
    async getSpeed(): Promise<number> {
        return await this.lib.getProp('speed');
    }
    /**
     * set the playback speed
     * @param speed 0.01 - 100
     */
    async setSpeed(speed: number): Promise<void> {
        if (speed < 0.01) speed = 0.01;
        else if (speed > 100) speed = 100;
        await this.lib.setProp('speed', speed);
    }

    /**
     * https://mpv.io/manual/stable/#options-start
     */
    async startOffset(start: string): Promise<void> {
        return await this.lib.setProp('start', start);
    }

    /**
     * https://mpv.io/manual/stable/#options-start
     */
    async endOffset(end: string): Promise<void> {
        return await this.lib.setProp('end', end);
    }

    /**
     * get volume, 0 - 100
     */
    async getVolume(): Promise<number> {
        return await this.lib.getProp('volume');
    }

    /**
     * set the volume, 0 - 100
     * @param volume
     */
    async setVolume(volume: number): Promise<void> {
        if (volume < 0) volume = 0;
        else if (volume > 100) volume = 100;
        await this.lib.setProp('volume', volume);
    }

    async addVolume(delta: number): Promise<void> {
        await this.lib.addProp('volume', delta);
    }

    async mute(): Promise<void> {
        await this.lib.setProp('mute', true);
    }

    async unmute(): Promise<void> {
        await this.lib.setProp('mute', false);
    }

    async toggleMute(mute?: boolean): Promise<void> {
        if (mute === true) {
            await this.mute();
        } else if (mute === false) {
            await this.unmute();
        } else {
            await this.lib.cycleProp('mute');
        }
    }

    async isMuted(): Promise<boolean> {
        return await this.lib.getProp('mute');
    }

    /**
     * get time position in seconds
     */
    async getTimePos(): Promise<number> {
        return await this.lib.getProp('time-pos');
    }

    /**
     * duration of current file. may be NaN if duration is unknown
     */
    async getDuration(): Promise<number> {
        return await this.lib.getProp('duration').catch(() => null);
    }

    /**
     * estimate remaining time in seconds
     */
    async getTimeRemaining(): Promise<number> {
        return await this.lib.getProp('time-remaining');
    }

    /**
     * get percent of current position, returned as a number between 0 , 100
     */
    async getPercentPosition(): Promise<number> {
        return await this.lib.getProp('percent-pos');
    }

    /**
     * exactly seek, when mode is relative-*, pos can be negative.
     * @param pos seconds or percent
     * @param mode
     */
    async seek(pos: number, mode: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' = 'relative') {
        await this.lib.exec('seek', pos, mode, 'exactly');
    }
    on = this.lib.on.bind(this.lib);
    once = this.lib.once.bind(this.lib);
    watch = this.lib.watchProp.bind(this.lib);
}
