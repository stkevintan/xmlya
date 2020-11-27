import * as vscode from 'vscode';
import { command, Runnable } from './runnable';
import { AppContext } from './app-context';
import { IContextTracks, ITrackAudio, XmlyaSDK } from '@xmlya/sdk';
import { Logger } from './lib/logger';

interface ICtrlButtonSpec {
    icon: string;
    title?: string;
    when?: (() => boolean) | string;
    command?: string;
}

const controllers: ICtrlButtonSpec[] = [
    {
        title: 'Previous track',
        icon: '$(chevron-left)',
        command: 'xmlya.player.goPrev',
        when: 'player.hasPrev',
    },
    {
        title: 'Next track',
        icon: '$(chevron-right)',
        command: 'xmlya.palyer.goNext',
        when: 'player.hasNext',
    },
    {
        title: 'Play',
        icon: '$(play)',
        command: 'xmlya.player.play',
        when: 'player.isPausing',
    },
    {
        title: 'Pause',
        icon: '$(debug-pause)',
        command: 'xmlya.player.pause',
        when: 'player.isPlaying',
    },
    {
        title: 'Ximalaya',
        icon: '$(book) 喜马拉雅',
        command: 'xmlya.user.menu',
    },
];

export class Player extends Runnable {
    private priBase = 600;
    private subscriptions: vscode.Disposable[] = [];

    private createControllers = (spec: ICtrlButtonSpec): vscode.StatusBarItem => {
        const btn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, this.priBase++);
        btn.text = spec.icon;
        btn.tooltip = spec.title;
        btn.command = spec.command;
        this.subscriptions.push(AppContext.onDidContextChange(evaluateWhen));
        evaluateWhen();
        this.subscriptions.push(btn);
        return btn;
        function evaluateWhen() {
            if (typeof spec.when === 'function') {
                return spec.when() ? btn.show() : btn.hide();
            }
            if (typeof spec.when === 'string') {
                return AppContext.getContext(spec.when) ? btn.show() : btn.hide();
            }
            btn.show();
        }
    };

    private isPlaying = false;

    private volume: number = 30;

    private playContext?: IContextTracks;

    private trackAudio?: ITrackAudio;

    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get trackInfo() {
        if (this.trackAudio === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.trackAudio?.trackId);
    }

    constructor(private sdk: XmlyaSDK) {
        super(() => {
            this.subscriptions.forEach((sub) => sub.dispose());
        });
        controllers.map(this.createControllers);
    }

    @command('player.playTrack')
    async playTrack(trackId: number) {
        if(trackId === undefined) return;
        [this.playContext, this.trackAudio] = await Promise.all([
            this.sdk.getContextTracks({ trackId }),
            this.sdk.getTrackAudio({ trackId }),
        ]);
        this.trackAudio.src = this.trackAudio.src ?? (await this.sdk.getNonFreeTrackAudioSrc({ trackId }));
        this.play();
    }

    @command('player.play')
    async play() {
        Logger.assert(this.trackAudio, 'No track to play.');
        Logger.assert(this.trackAudio.src, 'Get audio source failed');
        Logger.debug(this.trackAudio.src);
    }
}
