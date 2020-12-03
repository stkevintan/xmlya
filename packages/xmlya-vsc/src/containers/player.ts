import * as vscode from 'vscode';
import { command, Runnable } from '../runnable';
import { IContextTracks, ITrackAudio } from '@xmlya/sdk';
import { Logger } from '../lib/logger';
import { ConfigKeys, Configuration } from '../configuration';
import { StatusBar } from '../components/status-bar';
import { ellipsis, formatDuration, NA, openUrl } from '../lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf } from '../components/quick-pick';
import controls from '../playctrls.json';
import { ContextService } from 'src/context';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
const pipe = promisify(pipeline);

export class Player extends Runnable {
    private playContext?: IContextTracks;

    private currentTrack?: ITrackAudio;

    private mpv!: Mpv;

    private ctx!: ContextService;

    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get trackInfo() {
        if (this.currentTrack === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.currentTrack?.trackId);
    }

    initialize(context: ContextService) {
        this.mpv = new Mpv({
            mpvBinary: Configuration.mpvBinary,
            logLevel: 'debug',
            logger: console.log,
        });
        // put context to this.
        this.ctx = context;

        const syncCtxRefs = this.syncContext(context);
        const syncConfRefs = this.syncConf();
        // construct the status bar.
        const statusBar = new StatusBar(controls, -100);
        // render in current context
        statusBar.renderWith(context, 'player');
        return vscode.Disposable.from(...syncCtxRefs, ...syncConfRefs, statusBar);
    }

    private syncConf(): vscode.Disposable[] {
        const syncStart = () => {
            const { playbackStart } = Configuration;
            this.mpv.startOffset(playbackStart ? `+${Configuration.playbackStart}` : 'none');
        };
        const syncEnd = () => {
            const { playbackEnd } = Configuration;
            this.mpv.endOffset(playbackEnd ? `-${Configuration.playbackEnd}` : 'none');
        };
        syncStart();
        syncEnd();
        return [
            Configuration.onUpdate((keys) => {
                if (keys.includes(ConfigKeys.PlaybackStart)) {
                    syncStart();
                }
                if (keys.includes(ConfigKeys.PlaybackEnd)) {
                    syncEnd();
                }
            }),
        ];
    }

    private syncContext(ctx: ContextService): vscode.Disposable[] {
        // add watches
        return [
            this.mpv.watchProp<boolean>('core-idle', (active) => {
                if (!active) ctx.set('player.readyState', 'playing');
            }),
            this.mpv.watchProp<boolean>('idle-active', (active) => {
                if (active) ctx.set('player.readyState', 'idle');
            }),
            this.mpv.watchProp<boolean>('mute', (mute) => {
                ctx.set('player.isMuted', !!mute);
            }),

            this.mpv.watchProp<boolean>('seek', (seeking) => {
                if (seeking) ctx.set('player.readyState', 'seeking');
            }),
            this.mpv.watchProp<number>('volume', (volume) => {
                ctx.set('player.volume', volume);
            }),
            this.mpv.watchProp<number>('speed', (speed) => {
                ctx.set('player.speed', speed);
            }),
            this.mpv.onEvent(({ event, ...data }) => {
                switch (event) {
                    case 'start-file':
                        ctx.set('player.readyState', 'loading');
                        break;
                    case 'pause':
                        ctx.set('player.readyState', 'paused');
                        break;
                    case 'end-file':
                        if (['error', 'unknown'].includes(data.reason)) {
                            ctx.set('player.readyState', 'error');
                        } else if (data.reason === 'quit') {
                            ctx.set('plyaer.readyState', 'unload');
                        } else if (data.reason === 'eof') {
                            // try to play next track.
                            vscode.commands.executeCommand('xmlya.player.goNext');
                        }
                        break;
                }
            }),
        ];
    }

    @command('player.playTrack', 'Loading track...')
    async playTrack(trackId: number, albumId: number) {
        if (trackId === undefined || albumId === undefined) return;
        if (this.playContext === undefined || this.trackInfo?.albumId !== albumId) {
            this.playContext = await this.sdk.getContextTracks({ trackId });
        }
        this.currentTrack = await this.sdk.getTrackAudio({ trackId });

        Logger.assert(this.currentTrack, 'No track to play.');
        if (this.trackInfo) {
            this.ctx.set('player.trackTitle', `$(book) ${ellipsis(this.trackInfo.trackName, 20)}`);
        } else {
            this.ctx.set('player.trackTitle', ``);
        }
        const index = this.playList.findIndex((item) => item.trackId === this.currentTrack?.trackId);
        if (index !== -1) {
            this.ctx.set('player.hasPrev', index > 0 || this.playList[0].index !== 1);
            this.ctx.set('player.hasNext', index < this.playList.length - 1 || this.playContext.hasMore);
        } else {
            this.ctx.set('player.hasPrev', false);
            this.ctx.set('player.hasnext', false);
        }
        // set loading state ahead of time.
        try {
            this.ctx.set('player.readyState', 'loading');
            if (!this.currentTrack.src) {
                Logger.assertTrue(this.currentTrack.canPlay, `Track ${this.trackInfo?.trackName} is not playable.`);
                this.currentTrack.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.currentTrack.trackId });
            }

            Logger.assert(this.currentTrack.src, 'Get audio source failed');
        } catch (e) {
            this.ctx.set('player.readyState', 'error');
            throw e;
        }

        await this.mpv.play(this.currentTrack.src);
        // do not need await.
        this.resume();
    }

    @command('player.resume')
    async resume() {
        await this.mpv.play();
    }

    @command('player.pause')
    async pause() {
        await this.mpv.pause();
    }

    @command('player.toggleMute')
    async toggleMute(on?: boolean) {
        await this.mpv.toggleMute(on);
    }

    @command('player.loopVolume')
    async loopVolume() {
        const volume = this.ctx.get<string | number>('player.volume');
        if (typeof volume === 'number') {
            this.mpv.setVolume((volume + 20) % 120);
        }
    }

    @command('player.showTrackInfo')
    showTrackInfo() {
        const { trackInfo } = this;
        if (trackInfo === undefined) {
            Logger.throw('No track info found.');
        }
        const quickPick = new QuickPick();
        quickPick.render('Track Info', [
            new QuickPickTreeLeaf(`Track Name`, { description: trackInfo?.trackName ?? NA }),
            new QuickPickTreeLeaf(`Album Name`, { description: trackInfo?.albumName ?? NA }),
            new QuickPickTreeLeaf(`Update time`, { description: trackInfo?.updateTime ?? NA }),
            new QuickPickTreeLeaf(`Duration`, {
                description: formatDuration(trackInfo?.duration),
            }),
            new QuickPickTreeLeaf(`Play Source`, {
                description: this.currentTrack?.src ?? 'null',
                onClick: async (picker) => {
                    if (this.currentTrack?.src) {
                        picker.hide();
                        const choice = await vscode.window.showInformationMessage(
                            this.currentTrack.src,
                            'Download',
                            'Open in Browser'
                        );
                        if (choice === 'Download') {
                            const uri = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.parse(`~/${this.trackInfo?.trackName}.m4a`),
                                title: this.trackInfo?.trackName,
                            });
                            if (uri?.fsPath) {
                                try {
                                    vscode.window.withProgress(
                                        {
                                            title: 'Downloading...',
                                            location: vscode.ProgressLocation.Notification,
                                        },
                                        async () => {
                                            const stream = await this.sdk.download(this.currentTrack!.src!);
                                            await pipe(stream, createWriteStream(uri.fsPath, { encoding: 'binary' }));
                                        }
                                    );
                                } catch (e) {
                                    Logger.throw(e);
                                }
                            }
                        } else if (choice === 'Open in Browser') {
                            openUrl(this.currentTrack.src);
                        }
                    }
                },
            }),
        ]);
        quickPick.onDidHide(() => quickPick.dispose());
    }

    @command('player.setSpeed')
    setSpeed() {
        const quickPick = new QuickPick();
        const choices = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
        quickPick.render(
            'Set Playback Speed',
            choices.map(
                (speed) =>
                    new QuickPickTreeLeaf(`${speed} x`, {
                        onClick: async (picker) => {
                            picker.hide();
                            await this.mpv.setSpeed(speed);
                        },
                    })
            )
        );
        quickPick.onDidHide(() => quickPick.dispose());
    }

    @command('player.goNext', 'Loading next track...')
    async goNext() {
        const index = this.playList.findIndex((item) => item.trackId === this.currentTrack?.trackId);
        if (index < this.playList.length - 1) {
            const nextTrack = this.playList[index + 1];
            await this.playTrack(nextTrack.trackId, nextTrack.albumId);
        } else if (this.playContext?.hasMore) {
            this.playContext = await this.sdk.getContextTracks({ trackId: this.currentTrack!.trackId });
            await this.goNext();
        }
    }

    @command('player.goPrev', 'Loading previous track...')
    async goPrev() {
        const index = this.playList.findIndex((item) => item.trackId === this.currentTrack?.trackId);
        if (index > 0) {
            const prevTrack = this.playList[index - 1];
            await this.playTrack(prevTrack.trackId, prevTrack.albumId);
        }
        if (this.trackInfo?.index ?? 1 > 1) {
            this.playContext = await this.sdk.getContextTracks({ trackId: this.currentTrack!.trackId });
            await this.goPrev();
        }
    }
}
