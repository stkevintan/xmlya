import * as vscode from 'vscode';
import { command, Runnable } from './runnable';
import { IContextTracks, ITrackAudio, XmlyaSDK } from '@xmlya/sdk';
import { Logger } from './lib/logger';
import { Configuration } from './configuration';
import { IStatusBarItemSpec, StatusBar } from './components/status-bar';
import { Action, NA, RuntimeContext } from './lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf } from './components/quick-pick';

const statusItems: IStatusBarItemSpec[] = [
    {
        key: 'menu',
        tooltip: 'Ximalaya',
        text: '$(broadcast)',
        command: 'xmlya.user.menu',
    },
    {
        key: 'track',
        tooltip: 'track info',
        text: '{player.trackTitle}',
        command: 'xmlya.player.trackInfo',
        when: "player.readyState == 'playing' || player.readyState == 'paused'",
    },
    {
        key: 'unmute',
        tooltip: 'Unmute',
        text: '$(mute)',
        command: ['xmlya.player.toggleMute', false],
        when: 'player.isMuted',
    },
    {
        key: 'mute',
        tooltip: 'Mute',
        text: '$(unmute)',
        command: ['xmlya.player.toggleMute', true],
        when: '!player.isMuted',
    },
    {
        key: 'volume',
        tooltip: 'Volume',
        text: `{player.volume}`,
        command: 'xmlya.player.loopVolume',
        when: "player.readyState != 'unload'",
    },
    {
        key: 'prev',
        tooltip: 'Previous track',
        text: '$(chevron-left)',
        command: 'xmlya.player.goPrev',
        when: 'player.hasPrev',
    },
    {
        key: 'loading',
        tooltip: 'Loading',
        text: '$(loading)',
        when: "player.readyState == 'seeking' || player.readyState == 'loading'",
    },
    {
        key: 'pause',
        tooltip: 'Pause',
        text: '$(debug-pause)',
        command: 'xmlya.player.pause',
        when: "player.readyState == 'playing'",
    },
    {
        key: 'play',
        tooltip: 'Play',
        text: '$(play)',
        command: 'xmlya.player.play',
        when: "player.readyState == 'paused'",
    },
    {
        key: 'next',
        tooltip: 'Next track',
        text: '$(chevron-right)',
        command: 'xmlya.player.goNext',
        when: 'player.hasNext',
    },
    {
        key: 'speed',
        tooltip: 'Set playback speed',
        text: '{player.speed} X',
        command: 'xmlya.player.setSpeed',
        when: "player.readyState != 'unload'",
    },
];

export class Player extends Runnable {
    private subscriptions: vscode.Disposable[] = [];

    private playContext?: IContextTracks;

    private currentTrack?: ITrackAudio;

    private mpv: Mpv;

    private statusBar: StatusBar;
    private ctx: RuntimeContext;
    private progressResover?: Action;

    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get trackInfo() {
        if (this.currentTrack === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.currentTrack?.trackId);
    }

    constructor(private sdk: XmlyaSDK) {
        super(() => {
            this.progressResover?.();
            vscode.Disposable.from(...this.subscriptions, this.ctx, this.statusBar).dispose();
        });

        this.mpv = new Mpv({
            mpvBinary: Configuration.mpvBinary,
            logLevel: 'debug',
            logger: console.log,
        });

        this.ctx = new RuntimeContext({
            'player.readyState': 'unload',
            'player.isMuted': false,
            'player.hasNext': false,
            'player.hasPrev': false,
            'player.volume': NA,
            'player.trackTitle': NA,
            'player.speed': NA,
        });
        this.syncContext();
        this.statusBar = new StatusBar(statusItems.reverse(), 1024);
        this.statusBar.activate(this.ctx);
    }

    private syncContext() {
        return vscode.Disposable.from(
            this.mpv.watchProp<boolean>('core-idle', (active) => {
                if (!active) this.ctx.set('player.readyState', 'playing');
            }),
            this.mpv.watchProp<boolean>('idle-active', (active) => {
                if (active) this.ctx.set('player.readyState', 'idle');
            }),
            this.mpv.watchProp<boolean>('mute', (mute) => {
                this.ctx.set('player.isMuted', !!mute);
            }),

            this.mpv.watchProp<boolean>('seek', (seeking) => {
                if (seeking) this.ctx.set('player.readyState', 'seeking');
            }),
            this.mpv.watchProp<number>('volume', (volume) => {
                this.ctx.set('player.volume', volume);
            }),
            this.mpv.watchProp<number>('speed', (speed) => {
                this.ctx.set('player.speed', speed);
            }),
            this.mpv.onEvent(({ event, ...data }) => {
                switch (event) {
                    case 'start-file':
                        this.ctx.set('player.readyState', 'loading');
                        break;
                    case 'pause':
                        this.ctx.set('player.readyState', 'paused');
                        break;
                    case 'end-file':
                        if (['error', 'unknown'].includes(data.reason)) {
                            this.ctx.set('player.readyState', 'error');
                        } else if (data.reason === 'quit') {
                            this.ctx.set('plyaer.readyState', 'unload');
                        } else if (data.reason === 'eof') {
                            // try to play next track.
                            vscode.commands.executeCommand('xmlya.player.goNext');
                        }
                        break;
                }
            })
        );
    }

    @command('player.playTrack', 'Loading track...')
    async playTrack(trackId: number, albumId: number) {
        if (trackId === undefined || albumId === undefined) return;
        if (this.playContext === undefined || this.trackInfo?.albumId !== albumId) {
            this.playContext = await this.sdk.getContextTracks({ trackId });
        }
        this.currentTrack = await this.sdk.getTrackAudio({ trackId });

        Logger.assert(this.currentTrack, 'No track to play.');
        const index = this.playList.findIndex((item) => item.trackId === this.currentTrack?.trackId);

        if (index !== -1) {
            this.ctx.set('player.hasPrev', index > 0);
            this.ctx.set('player.hasNext', index < this.playList.length - 1 || this.playContext.hasMore);
        } else {
            this.ctx.set('player.hasPrev', false);
            this.ctx.set('player.hasnext', false);
        }
        this.ctx.set('player.trackTitle', this.trackInfo?.trackName ?? NA);

        if (!this.currentTrack.src) {
            Logger.assertTrue(this.currentTrack.canPlay, `Track ${this.trackInfo?.trackName} is not playable.`);
            this.currentTrack.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.currentTrack.trackId });
        }

        Logger.assert(this.currentTrack.src, 'Get audio source failed');
        await this.mpv.play(this.currentTrack.src);
    }

    @command('player.play')
    async play() {
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

    @command('player.trackInfo')
    showTrackInfo() {
        const { trackInfo } = this;
        if (trackInfo === undefined) {
            Logger.throw('No track info found.');
        }
        const quickPick = new QuickPick();
        quickPick.render('Track Info', [
            new QuickPickTreeLeaf(`Track Name: ${trackInfo?.trackName ?? NA}`),
            new QuickPickTreeLeaf(`Album Name: ${trackInfo?.albumName ?? NA}`),
            new QuickPickTreeLeaf(`Update time: ${trackInfo?.updateTime ?? NA}`),
            new QuickPickTreeLeaf(`Duration: ${trackInfo?.duration ?? NA}`),
            new QuickPickTreeLeaf(`Play Source: ${this.currentTrack?.src ?? NA}`),
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
                    new QuickPickTreeLeaf(`${speed} X`, {
                        action: async (pick) => {
                            try {
                                await this.mpv.setSpeed(speed);
                            } finally {
                                pick.dispose();
                            }
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
    }
}
