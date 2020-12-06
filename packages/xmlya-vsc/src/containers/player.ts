import * as vscode from 'vscode';
import { command, Runnable } from '../runnable';
import { IContextTracks, IPaginator, ISortablePaginator, ITrackAudio } from '@xmlya/sdk';
import { Logger } from '../lib/logger';
import { ConfigKeys, Configuration } from '../configuration';
import { StatusBar } from '../components/status-bar';
import { Callback, ellipsis, formatDuration, NA, openUrl } from '../lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import controls from '../playctrls.json';
import { ContextService } from 'src/context';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { throttle } from 'throttle-debounce-ts';
const pipe = promisify(pipeline);

export class Player extends Runnable {
    private playContext?: IContextTracks;

    private quickPick: QuickPick = new QuickPick();
    private playingTrack?: ITrackAudio;

    private mpv!: Mpv;

    private ctx!: ContextService;

    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get playingTrackInfo() {
        if (this.playingTrack === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.playingTrack?.trackId);
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
        return vscode.Disposable.from(
            ...syncCtxRefs,
            ...syncConfRefs,
            statusBar,
            { dispose: () => this.progressToken?.() },
            { dispose: () => this.quickPick?.dispose() }
        );
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
            this.mpv.watchProp<number>(
                'percent-pos',
                throttle(1000, (percent: number) => {
                    percent = Math.floor(percent);
                    const ret = Number.isNaN(percent) ? undefined : percent;
                    ctx.set('player.percentPos', ret);
                })
            ),
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
        this.playingTrack = await this.sdk.getTrackAudio({ trackId });
        Logger.assert(this.playingTrack, 'No track to play.');
        // if playContext is outdated.
        if (this.playContext === undefined || this.playingTrackInfo?.albumId !== albumId) {
            this.playContext = await this.sdk.getContextTracks({ trackId });
        }

        if (this.playingTrackInfo) {
            this.ctx.set('player.trackTitle', ellipsis(this.playingTrackInfo.trackName, 20));
        } else {
            this.ctx.set('player.trackTitle', ``);
        }
        const index = this.playList.findIndex((item) => item.trackId === this.playingTrack?.trackId);
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
            if (!this.playingTrack.src) {
                Logger.assertTrue(
                    this.playingTrack.canPlay,
                    `Track ${this.playingTrackInfo?.trackName} is not playable.`
                );
                this.playingTrack.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.playingTrack.trackId });
            }

            Logger.assert(this.playingTrack.src, 'Get audio source failed');
        } catch (e) {
            this.ctx.set('player.readyState', 'error');
            throw e;
        }

        await this.mpv.play(this.playingTrack.src);
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

    @command('player.setVolume')
    async setVolume() {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const generateVols = (value?: number) => [
            this.ctx.get('player.isMuted')
                ? new QuickPickTreeLeaf('$(unmute)', {
                      description: 'Unmute',
                      alwaysShow: true,
                      onClick: () => {
                          this.toggleMute(false);
                          quickPick.hide();
                      },
                  })
                : new QuickPickTreeLeaf('$(mute)', {
                      description: 'Mute',
                      alwaysShow: true,
                      onClick: () => {
                          this.toggleMute(true);
                          quickPick.hide();
                      },
                  }),
            ...(value !== undefined
                ? [
                      new QuickPickTreeLeaf(`${value}`, {
                          onClick: () => {
                              this.mpv.toggleMute(false);
                              this.mpv.setVolume(value);
                              quickPick.hide();
                          },
                      }),
                  ]
                : Array.from(
                      { length: 10 },
                      (_, i) =>
                          new QuickPickTreeLeaf('$(symbol-variable)', {
                              active: (10 - i) * 10 === this.ctx.get('player.volume'),
                              description: `${(10 - i) * 10}`,
                              onClick: () => {
                                  this.mpv.toggleMute(false);
                                  this.mpv.setVolume((10 - i) * 10);
                                  quickPick.hide();
                              },
                          })
                  )),
        ];
        quickPick.render('Set volume, type a integer between 0 to 100...', generateVols());
        quickPick.onDidChangeValue((value) => {
            const vol = Number(value);
            if (value && !Number.isNaN(vol) && vol >= 0 && vol <= 100) {
                quickPick.repaint(generateVols(vol));
            } else {
                quickPick.repaint(generateVols());
            }
        });
        // const volume = this.ctx.get<string | number>('player.volume');
        // if (typeof volume === 'number') {
        //     this.mpv.setVolume((volume + 20) % 120);
        // }
    }

    @command('player.showTrackInfo')
    async showTrackInfo() {
        const { playingTrackInfo: trackInfo } = this;
        Logger.assert(trackInfo, 'No track found.');
        this.quickPick.loading(trackInfo.trackName);
        const album = await this.sdk.getAlbumWithTracks({ albumId: trackInfo.albumId });
        const items = [
            new QuickPickTreeLeaf('$(history)', {
                description: `${trackInfo.updateTime} | ${formatDuration(trackInfo.duration)}`,
            }),
            new QuickPickTreeLeaf('$(account)', {
                description: album.anchorInfo.anchorName,
                onClick: () => {
                    vscode.commands.executeCommand('xmlya.common.showUser', this.quickPick, trackInfo.anchorId);
                },
            }),
            new QuickPickTreeLeaf('$(repo)', {
                description: trackInfo.albumName,
                onClick: () => {
                    vscode.commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
                        title: trackInfo.albumName,
                        id: trackInfo.albumId,
                        subTitle: album.mainInfo.shortIntro,
                    });
                },
            }),
            new QuickPickTreeLeaf('$(cloud-download)', {
                description: 'Download audio source...',
                onClick: () => {
                    this.quickPick.hide();
                    this.showTrackUrl();
                },
            }),
            new QuickPickTreeLeaf('$(inbox)', {
                description: 'View comments...',
                onClick: () => {
                    this.viewComments(this.playingTrackInfo);
                },
            }),
        ];
        this.quickPick.render(trackInfo.trackName, items);
    }

    @command('player.showPlaylist')
    async showPlayList() {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const items = this.playList.map((item) => {
            if (item.trackId === this.playingTrack?.trackId) {
                return new QuickPickTreeLeaf(item.trackName, {
                    description: formatDuration(item.duration),
                    active: true,
                    onClick: () => {
                        vscode.commands.executeCommand('xmlya.player.showTrackInfo');
                        quickPick.hide();
                    },
                });
            }
            return new QuickPickTreeLeaf(item.trackName, {
                description: formatDuration(item.duration),
                onClick: () => {
                    quickPick.hide();
                    this.playTrack(item.trackId, item.albumId);
                },
            });
        });
        if (items.length) {
            quickPick.render('Playlist', items);
        }
    }

    @command('player.showTrackUrl')
    async showTrackUrl({ src, name }: { src?: string; name?: string } = {}) {
        src = src ?? this.playingTrack?.src;
        name = name ?? this.playingTrackInfo?.trackName;
        Logger.assert(src, 'Track source is required');
        const choice = await vscode.window.showInformationMessage(src, 'Download', 'Open in Browser');
        if (choice === 'Download') {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.parse(`~/${name ?? 'audio'}.m4a`),
                title: name ?? 'audio',
            });
            if (uri?.fsPath) {
                try {
                    vscode.window.withProgress(
                        {
                            title: 'Downloading...',
                            location: vscode.ProgressLocation.Notification,
                        },
                        async () => {
                            const stream = await this.sdk.download(src!);
                            await pipe(stream, createWriteStream(uri.fsPath, { encoding: 'binary' }));
                        }
                    );
                } catch (e) {
                    Logger.throw(e);
                }
            }
        } else if (choice === 'Open in Browser') {
            openUrl(src);
        }
    }

    @command('player.viewComments')
    async viewComments(
        { trackId, trackName }: { trackId?: number; trackName?: string } = {},
        params?: IPaginator,
        bySelf = false
    ) {
        trackId = trackId ?? this.playingTrackInfo?.trackId;
        trackName = trackName ?? this.playingTrackInfo?.trackName;
        if (trackId === undefined) return;
        this.quickPick.loading(trackName ?? 'Comments...');
        const ret = await this.sdk.getCommentsOfTrack({ trackId, ...params });
        this.quickPick.render(
            trackName ?? 'Comments...',
            {
                pagination: { pageNum: ret.pageNum, pageSize: ret.pageSize, totalCount: ret.totalCount },
                onPageChange: (pageNum) => this.viewComments({ trackId, trackName }, { ...params, pageNum }, true),
                items: ret.comments.map((comment) => {
                    if (comment.replies?.length) {
                        return new QuickPickTreeParent(comment.nickname, {
                            description: comment.createAt,
                            detail: comment.content,
                            children: comment.replies.map(
                                (reply) =>
                                    new QuickPickTreeLeaf(`${reply.nickname} (to ${reply.parentNickname})`, {
                                        description: reply.createAt,
                                        detail: reply.content,
                                    })
                            ),
                        });
                    }
                    return new QuickPickTreeLeaf(comment.nickname, {
                        description: comment.createAt,
                        detail: comment.content,
                    });
                }),
            },
            bySelf ? 'replace' : 'push'
        );
    }

    @command('player.setSpeed')
    setSpeed() {
        const quickPick = new QuickPick();
        const choices = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
        quickPick.render(
            'Set Playback Speed',
            choices.map(
                (speed) =>
                    new QuickPickTreeLeaf(`$(symbol-event)`, {
                        active: this.ctx.get('player.speed') === speed,
                        description: `${speed}x`,
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
        Logger.assert(this.playingTrackInfo, 'No track');
        const index = this.playingTrackInfo.index + 1;
        let track = this.playList.find((item) => item.index === index);
        if (!track && this.playContext?.hasMore) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: this.playingTrackInfo.albumId,
                index,
            });
            track = this.playList.find((item) => item.index === index);
        }
        if (track) {
            await this.playTrack(track.trackId, track.albumId);
        } else {
            vscode.window.showWarningMessage('Failed to get next track');
        }
    }

    @command('player.goPrev', 'Loading previous track...')
    async goPrev() {
        Logger.assert(this.playingTrackInfo, 'No track');
        const index = this.playingTrackInfo.index - 1;
        let track = this.playList.find((item) => item.index === index);
        if (!track && this.playingTrackInfo && this.playingTrackInfo.index > 1) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: this.playingTrackInfo.albumId,
                index,
            });
            track = this.playList.find((item) => item.index === index);
        }
        if (track) {
            await this.playTrack(track.trackId, track.albumId);
        } else {
            vscode.window.showWarningMessage('Failed to get previous track');
        }
    }

    private progressToken: Callback<void> | undefined;
    @command('player.toggleProgress')
    async toggleProgress(show?: boolean) {
        if (this.progressToken) {
            this.progressToken();
            this.progressToken = undefined;
            if (show === undefined) return;
        }
        if (show === false) {
            return;
        }
        const disposable = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
            },
            async (progress) => {
                progress.report({ message: 'No track' });
                let prev = 0;
                return new Promise<vscode.Disposable>((resolve) => {
                    this.progressToken = () => resolve(handler);
                    const handler = this.ctx.onChange((keys) => {
                        if (keys.includes('player.percentPos') && this.playingTrackInfo) {
                            const percent = this.ctx.get<number | undefined>('player.percentPos') ?? 0;
                            const increment = percent - prev;
                            prev = percent;
                            progress.report({
                                increment,
                                message: `Playing: ${this.playingTrackInfo.trackName} (${percent}%)`,
                            });
                        }
                    });
                });
            }
        );
        disposable.dispose();
    }
}
