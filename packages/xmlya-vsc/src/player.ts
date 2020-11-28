import * as vscode from 'vscode';
import { command, Runnable } from './runnable';
import { ObservableContext } from './lib/context';
import { IContextTracks, ITrackAudio, XmlyaSDK } from '@xmlya/sdk';
import { Logger } from './lib/logger';
import Mpv from 'node-mpv';
import { Configuration } from './configuration';
import { IStatusBarItemSpec, StatusBar } from './components/status-bar';

// const statusItems: IStatusBarItemSpec[] = [
//     {
//         title: 'Previous track',
//         icon: '$(chevron-left)',
//         command: 'xmlya.player.goPrev',
//         when: 'player.hasPrev',
//     },
//     {
//         title: 'Next track',
//         icon: '$(chevron-right)',
//         command: 'xmlya.palyer.goNext',
//         when: 'player.hasNext',
//     },
//     {
//         title: 'Play',
//         icon: '$(play)',
//         command: 'xmlya.player.play',
//         when: 'player.isPausing',
//     },
//     {
//         title: 'Pause',
//         icon: '$(debug-pause)',
//         command: 'xmlya.player.pause',
//         when: 'player.isPlaying',
//     },
//     {
//         title: 'Ximalaya',
//         icon: '$(book) 喜马拉雅',
//         command: 'xmlya.user.menu',
//     },
//     () => ({
//         title: 'Volume',
//         icon: `${AppContext.getContext('player.volume') ?? '20'}`,
//         command: 'xmlya.player.loopVolume',
//     }),
//     {
//         title: 'Mute',
//         icon: '$(unmute)',
//         command: 'xmlya.player.toggleMute',
//         args: [true],
//         when: '!player.isMuted',
//     },
//     {
//         title: 'Unmute',
//         icon: '$(mute)',
//         command: 'xmlya.player.toggleMute',
//         args: [false],
//         when: 'player.isMuted',
//     },
// ];

export class Player extends Runnable {
    private subscriptions: vscode.Disposable[] = [];
    private mpv = new Mpv({
        audio_only: true,
        binary: Configuration.mpvBinary,
        debug: true,
    });

    private _mpvStartingPromise?: Promise<void>;
    private async ensureMpvStarted(): Promise<void> {
        if (this.mpv.isRunning()) return;
        Logger.debug('starting mpv...');
        if (!this._mpvStartingPromise) {
            this._mpvStartingPromise = this.mpv.start().then(() => this.mpv.volume(this.volume));
        }
        await this._mpvStartingPromise;
        this._mpvStartingPromise = undefined;
        Logger.debug('mpv started');
    }

    private volume: number = 20;

    private playContext?: IContextTracks;

    private currentTrack?: ITrackAudio;

    private statusBar: StatusBar = new StatusBar(1000);

    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get trackInfo() {
        if (this.currentTrack === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.currentTrack?.trackId);
    }

    constructor(private sdk: XmlyaSDK) {
        super(() => {
            this.subscriptions.forEach((sub) => sub.dispose());
            if (this.mpv.isRunning()) {
                this.mpv.stop();
            }
        });
        this.initControllers();

        ObservableContext.setContexts({
            'player.isPlaying': false,
            'player.isPausing': false,
            'player.isMuted': false,
            'player.volume': this.volume,
        });

        this.ensureMpvStarted();
    }

    private initControllers() {}

    @command('player.playTrack')
    async playTrack(trackId: number) {
        if (trackId === undefined) return;
        [this.playContext, this.currentTrack] = await Promise.all([
            this.sdk.getContextTracks({ trackId }),
            this.sdk.getTrackAudio({ trackId }),
        ]);

        Logger.assert(this.currentTrack, 'No track to play.');
        if (!this.currentTrack.src) {
            Logger.assertTrue(this.currentTrack.canPlay, `Track ${this.trackInfo?.trackName} is not playable.`);
            this.currentTrack.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.currentTrack.trackId });
        }

        Logger.assert(this.currentTrack.src, 'Get audio source failed');
        Logger.debug(this.currentTrack.src);
        await this.ensureMpvStarted();
        await this.mpv.load(this.currentTrack.src, 'replace');
        ObservableContext.setContexts({
            'player.isPlaying': true,
            'palyer.isPausing': false,
            'player.currentTrack': trackId,
        });
    }

    @command('player.play')
    async play() {
        await this.ensureMpvStarted();
        if (ObservableContext.getContext('player.isPlaying')) {
            return;
        }
        await this.mpv.play();
        ObservableContext.setContexts({
            'player.isPlaying': true,
            'player.isPausing': false,
        });
    }

    @command('player.pause')
    async pause() {
        await this.ensureMpvStarted();
        if (ObservableContext.getContext('player.isPausing')) {
            return;
        }
        await this.mpv.pause();
        ObservableContext.setContexts({
            'player.isPlaying': false,
            'player.isPausing': true,
        });
    }

    @command('player.toggleMute')
    async toggleMute(isMuted?: boolean) {
        await this.ensureMpvStarted();
        isMuted = isMuted ?? !(await this.mpv.isMuted());
        await this.mpv.mute(isMuted);
        ObservableContext.setContext('player.isMuted', !isMuted);
    }

    @command('player.loopVolume')
    async loopVolume() {
        await this.ensureMpvStarted();
        const volume = (this.volume + 20) % 120;
        await this.mpv.volume(volume);
        ObservableContext.setContext('player.volume', (this.volume = volume));
    }
}
