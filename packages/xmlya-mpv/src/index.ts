import path from 'path';
import { Defer } from './common';
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

export class Mpv extends LibMpv {
    constructor(options: IMpvOptions) {
        super(options);
        Logger.logger = options.logger;
        Logger.Level = options.logLevel ?? 'info';
    }
    /**
     * load source in timeout millionseconds
     * @param source
     * @param timeout
     */
    async play(): Promise<void>;
    async play(source: string, timeout?: number): Promise<void>;
    async play(source?: string, timeout?: number): Promise<void> {
        if (source === undefined) {
            return await this.setProp('pause', false);
        }
        if (!source.startsWith('http')) {
            source = path.resolve(source);
        }
        // wait for file loaded
        const defer = new Defer(timeout, () => {
            handle.dispose();
        });

        let started = false;
        const handle = this.onEvent(({ event }) => {
            if (event === 'start-file') {
                started = true;
            } else if (started && event === 'file-loaded') {
                defer.resolve();
                handle.dispose();
            } else if (started && event === 'end-file') {
                defer.reject('file load error');
            }
        });
        await this.exec('loadfile', source);
        await defer.asPromise();
    }

    async pause(): Promise<void> {
        await this.setProp('pause', true);
    }

    async resume(): Promise<void> {
        await this.setProp('pause', false);
    }

    async togglePause(pause?: boolean): Promise<void> {
        if (pause === true) await this.pause();
        else if (pause === false) await this.resume();
        else await this.cycleProp('pause');
    }

    async stop(): Promise<void> {
        await this.exec('stop');
    }

    /**
     * get the speed
     */
    async getSpeed(): Promise<number> {
        return await this.getProp('speed');
    }
    /**
     * set the playback speed
     * @param speed 0.01 - 100
     */
    async setSpeed(speed: number): Promise<void> {
        if (speed < 0.01) speed = 0.01;
        else if (speed > 100) speed = 100;
        await this.setProp('speed', speed);
    }

    /**
     * https://mpv.io/manual/stable/#options-start
     */
    async startOffset(start: string): Promise<void> {
        return await this.setProp('start', start);
    }

    /**
     * https://mpv.io/manual/stable/#options-start
     */
    async endOffset(end: string): Promise<void> {
        return await this.setProp('end', end);
    }

    /**
     * get volume, 0 - 100
     */
    async getVolume(): Promise<number> {
        return await this.getProp('volume');
    }

    /**
     * set the volume, 0 - 100
     * @param volume
     */
    async setVolume(volume: number): Promise<void> {
        if (volume < 0) volume = 0;
        else if (volume > 100) volume = 100;
        await this.setProp('volume', volume);
    }

    async addVolume(delta: number): Promise<void> {
        await this.addProp('volume', delta);
    }

    async mute(): Promise<void> {
        await this.setProp('mute', true);
    }

    async unmute(): Promise<void> {
        await this.setProp('mute', false);
    }

    async toggleMute(mute?: boolean): Promise<void> {
        if (mute === true) {
            await this.mute();
        } else if (mute === false) {
            await this.unmute();
        } else {
            await this.cycleProp('mute');
        }
    }

    async isMuted(): Promise<boolean> {
        return await this.getProp('mute');
    }

    /**
     * get time position in seconds
     */
    async getTimePos(): Promise<number> {
        return await this.getProp('time-pos');
    }

    /**
     * duration of current file. may be NaN if duration is unknown
     */
    async getDuration(): Promise<number> {
        return await this.getProp('duration').catch(() => null);
    }

    /**
     * estimate remaining time in seconds
     */
    async getTimeRemaining(): Promise<number> {
        return await this.getProp('time-remaining');
    }

    /**
     * get percent of current position, returned as a number between 0 , 100
     */
    async getPercentPosition(): Promise<number> {
        return await this.getProp('percent-pos');
    }

    /**
     * exactly seek, when mode is relative-*, pos can be negative.
     * @param pos seconds or percent
     * @param mode
     */
    async seek(pos: number, mode: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' = 'relative') {
        const defer = new Defer(() => handle.dispose());
        let started = false;
        const handle = this.onEvent(({ event }) => {
            if (event === 'seek') {
                started = true;
            } else if (started && event === 'playback-restart') {
                handle.dispose();
                defer.resolve();
            }
        });
        await this.exec('seek', pos, mode, 'exactly');
        await defer.asPromise();
    }
}
