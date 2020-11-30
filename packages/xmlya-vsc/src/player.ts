import * as vscode from 'vscode';
import { command, Runnable } from './runnable';
import { IContextTracks, ITrackAudio, XmlyaSDK } from '@xmlya/sdk';
import { Logger } from './lib/logger';
import { Configuration } from './configuration';
import { IStatusBarItemSpec, StatusBar } from './components/status-bar';
import { Action, NA, RuntimeContext } from './lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf } from './components/quick-pick';
import { timeStamp } from 'console';

// from right to left
const statusItems: IStatusBarItemSpec[] = [
    {
        key: 'menu',
        tooltip: 'Ximalaya',
        text: '$(broadcast)',
        command: 'xmlya.user.menu',
    },

    {
        key: 'next',
        tooltip: 'Next track',
        text: '$(chevron-right)',
        command: 'xmlya.player.goNext',
        when: 'player.hasNext',
    },
    {
        key: 'play',
        tooltip: 'Play',
        text: '$(play)',
        command: 'xmlya.player.play',
        when: (ctx) => ctx.get('player.readyState') === 'paused',
    },
    {
        key: 'pause',
        tooltip: 'Pause',
        text: '$(debug-pause)',
        command: 'xmlya.player.pause',
        when: (ctx) => ctx.get('player.readyState') === 'playing',
    },
    // {
    //     key: 'idle',
    //     tooltip: 'No track',
    //     text: '$(primitive-square)',
    //     color: 'rgba(255,255,255,0.5)',
    //     when: (ctx) => ctx.get('player.readyState') === 'idle',
    // },
    {
        key: 'loading',
        tooltip: 'Loading',
        text: '$(loading)',
        when: (ctx) => ['seeking', 'loading'].includes(ctx.get('player.readyState') ?? ''),
    },
    {
        key: 'prev',
        tooltip: 'Previous track',
        text: '$(chevron-left)',
        command: 'xmlya.player.goPrev',
        when: 'player.hasPrev',
    },
    {
        key: 'volume',
        tooltip: 'Volume',
        text: `{player.volume}`,
        command: 'xmlya.player.loopVolume',
        when: (ctx) => ctx.get('player.readyState') !== 'unload',
    },
    {
        key: 'mute',
        tooltip: 'Mute',
        text: '$(unmute)',
        command: { command: 'xmlya.player.toggleMute', arguments: [true], title: 'mute' },
        when: '!player.isMuted',
    },
    {
        key: 'unmute',
        tooltip: 'Unmute',
        text: '$(mute)',
        command: { command: 'xmlya.player.toggleMute', title: 'unmute', arguments: [false] },
        when: 'player.isMuted',
    },
    {
        key: 'track',
        tooltip: 'track info',
        text: '{player.trackTitle}',
        command: 'xmlya.player.trackInfo',
        when: (ctx) => ['playing', 'paused'].includes(ctx.get('player.readyState') ?? ''),
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
            vscode.Disposable.from(...this.subscriptions, this.ctx).dispose();
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
        });
        this.statusBar = new StatusBar(this.ctx, 1024);
        this.initControllers();
        this.syncContext();
    }

    private initControllers() {
        for (const item of statusItems) {
            this.statusBar.addItem(item.key, item);
        }
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
        Logger.debug(this.currentTrack.src);
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
            new QuickPickTreeLeaf(`Track Name  : ${trackInfo?.trackName}`),
            new QuickPickTreeLeaf(`Album Name  : ${trackInfo?.albumName}`),
            new QuickPickTreeLeaf(`Update time : ${trackInfo?.updateTime}`),
            new QuickPickTreeLeaf(`Duration    : ${trackInfo?.duration}`),
        ]);
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
