import path from 'path';
import { Disposable } from 'vscode';
import { Callback, Defer, noop } from '../common';
import { isResultReply, MpvClient } from './client';

export class Mpv extends MpvClient {
    /**
     * load source in timeout millionseconds
     * @param source
     * @param timeout
     */
    async play(source: string, timeout = 10 * 1000) {
        if (!source.startsWith('http')) {
            source = path.resolve(source);
        }
        await this.exec('loadfile', source);
        // wait for file loaded
        const defer = new Defer(timeout, () => {
            handle.dispose();
        });

        let started = false;
        const handle = this.replies$.event((reply) => {
            if (isResultReply(reply)) {
                return;
            }
            if (reply.event === 'start-file') {
                started = true;
                return;
            }
            if (!started) return;

            switch (reply.event) {
                case 'file-loaded':
                    handle.dispose();
                    defer.resolve();
                    break;
                case 'end-file':
                    defer.reject('file load error');
                    break;
            }
        });

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
     * adjust the playback speed
     * @param factor 0.01 - 100
     */
    async setSpeed(factor: number): Promise<void> {
        await this.setProp('speed', factor);
    }

    /**
     * get volume, 0 - 100
     */
    async getVolume(): Promise<number> {
        return await this.getProp('volume');
    }

    async setVolume(volume: number): Promise<void> {
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
     * exactly seek, when mode is relative-*, pos can be negative.
     * @param pos seconds or percent
     * @param mode
     */
    async seek(pos: number, mode: 'relative' | 'absolute' | 'absolute-percent' | 'relative-percent' = 'relative') {
        const defer = new Defer(() => {
            handle.dispose();
        });
        let started = false;
        const handle = this.replies$.event((reply) => {
            if (isResultReply(reply)) return;
            if (reply.event === 'seek') {
                started = true;
            }
            if (started && reply.event === 'playback-restart') {
                handle.dispose();
                defer.resolve();
            }
        });
        await this.exec('seek', pos, mode, 'exactly');
        await defer.asPromise();
    }
}
