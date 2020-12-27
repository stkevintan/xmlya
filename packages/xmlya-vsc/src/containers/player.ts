import * as vscode from 'vscode';
import { command, Runnable } from '../runnable';
import {
    GetAlbumWithTracksResult,
    GetContextTracksResult,
    GetTrackAudioResult,
    GetTrackPageInfoResult,
    IPaginator,
} from '@xmlya/sdk';
import { Logger } from '../lib/logger';
import { ConfigKeys, Configuration } from '../configuration';
import { StatusBar } from '../components/status-bar';
import { asyncInterval, delay, ellipsis, formatDuration, openUrl } from '../lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import controls from '../playctrls.json';
import { ContextService } from 'src/context';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { Terminal, TerminalEvents } from '../components/terminal';
const pipe = promisify(pipeline);

export class Player extends Runnable {
    private quickPick: QuickPick = new QuickPick();

    private playingAudio?: GetTrackAudioResult;
    private playingTrack?: GetTrackPageInfoResult;
    private playContext?: GetContextTracksResult;
    get playList() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    private terminal!: Terminal;

    private mpv!: Mpv;

    private ctx!: ContextService;

    async initialize(context: ContextService) {
        this.mpv = await Mpv.create({
            mpvBinary: Configuration.mpvBinary,
            args: Configuration.mpvAguments,
            volume: context.globalState.get('xmlya.player.volume'),
            speed: context.globalState.get('xmlya.player.speed'),
            mute: context.globalState.get('xmlya.player.isMuted'),
            logLevel: 'debug',
            logger: console.log,
        });

        this.terminal = new Terminal();
        // put context to this.
        this.ctx = context;
        const syncCtxRefs = this.syncContext(context);
        const syncConfRefs = this.syncConf();
        // construct the status bar.
        const statusBar = new StatusBar(controls, Configuration.statusBarItemBase);
        // render in current context
        statusBar.renderWith(context, 'player');
        // start trace
        const traceRef = this.ctx.onChange((keys) => {
            if (keys.includes('player.readyState')) {
                void this.toggleTrace(this.ctx.get('player.readyState') === 'playing');
            }
        });

        return vscode.Disposable.from(
            ...syncCtxRefs,
            ...syncConfRefs,
            statusBar,
            this.quickPick,
            this.terminal,
            traceRef,
            {
                dispose: () => this.traceContext?.start(),
            }
        );
    }

    private syncConf(): vscode.Disposable[] {
        const syncStart = () => {
            const { playbackStart } = Configuration;
            void this.mpv.startOffset(playbackStart ? `+${Configuration.playbackStart}` : 'none');
        };
        const syncEnd = () => {
            const { playbackEnd } = Configuration;
            void this.mpv.endOffset(playbackEnd ? `-${Configuration.playbackEnd}` : 'none');
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
            this.mpv.watch<boolean>('core-idle', (active) => {
                if (!active) ctx.set('player.readyState', 'playing');
            }),
            this.mpv.watch<boolean>('idle-active', (active) => {
                if (active) ctx.set('player.readyState', 'idle');
            }),
            this.mpv.watch<boolean>('mute', (mute) => {
                ctx.set('player.isMuted', !!mute);
                void ctx.globalState.update('xmlya.player.isMuted', !!mute);
            }),

            this.mpv.watch<boolean>('seek', (seeking) => {
                if (seeking) ctx.set('player.readyState', 'seeking');
            }),
            this.mpv.watch<number>('volume', (volume) => {
                ctx.set('player.volume', volume);
                void ctx.globalState.update('xmlya.player.volume', volume);
            }),
            this.mpv.watch<number>('time-remaining', (countdown) => {
                countdown = Math.ceil(countdown);
                const prevRemaining = ctx.get<number>('player.timeRemaining');
                if (prevRemaining === countdown) return;
                ctx.set('player.timeRemaining', countdown);
                ctx.set('player.timeRemainingFormatted', formatDuration(countdown));
            }),
            this.mpv.watch<number>('speed', (speed) => {
                ctx.set('player.speed', speed);
                void ctx.globalState.update('xmlya.player.speed', speed);
            }),
            // too many logs
            // this.mpv.watchProp<number>(
            //     'percent-pos',
            //     throttle(1000, (percent: number) => {
            //         percent = Math.floor(percent);
            //         const ret = Number.isNaN(percent) ? undefined : percent;
            //         ctx.set('player.percentPos', ret);
            //     })
            // ),
            this.mpv.on('start-file', () => {
                ctx.set('player.readyState', 'loading');
            }),
            this.mpv.on('pause', () => {
                ctx.set('player.readyState', 'paused');
            }),
            this.mpv.on('end-file', (data) => {
                if (['error', 'unknown'].includes(data.reason)) {
                    ctx.set('player.readyState', 'error');
                } else if (data.reason === 'quit') {
                    ctx.set('plyaer.readyState', 'unload');
                } else if (data.reason === 'eof') {
                    // try to play next track.
                    void vscode.commands.executeCommand('xmlya.player.goNext');
                }
            }),
        ];
    }

    @command('player.playTrack', 'Loading track...')
    async playTrack(trackId: number, albumId: number) {
        if (trackId === undefined || albumId === undefined) return;
        this.playingAudio = await this.sdk.getTrackAudio({ trackId });
        Logger.assert(this.playingAudio, 'No track to play.');
        // if playContext is outdated.
        if (this.playContext === undefined || this.playingTrack?.albumInfo?.albumId !== albumId) {
            this.playContext = await this.sdk.getContextTracks({ trackId });
        }

        this.playingTrack = await this.sdk.getTrackPageInfo({ trackId });
        this.ctx.set('player.trackTitle', ellipsis(this.playingTrack.trackInfo.title, 20));

        const index = this.playList.findIndex((item) => item.trackId === this.playingAudio?.trackId);
        if (index !== -1) {
            this.ctx.set('player.hasPrev', index > 0 || this.playList[0].index !== 1);
            this.ctx.set('player.hasNext', index < this.playList.length - 1 || this.playContext!.hasMore);
        } else {
            this.ctx.set('player.hasPrev', false);
            this.ctx.set('player.hasnext', false);
        }
        // set loading state ahead of time.
        try {
            this.ctx.set('player.readyState', 'loading');
            if (!this.playingAudio.src) {
                Logger.assertTrue(
                    this.playingAudio.canPlay,
                    `Track ${this.playingTrack.trackInfo.title} is not playable.`
                );
                this.playingAudio.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.playingAudio.trackId });
            }

            Logger.assert(this.playingAudio.src, 'Get audio source failed');
        } catch (e) {
            this.ctx.set('player.readyState', 'error');
            throw e;
        }

        await this.mpv.play(this.playingAudio.src);
        // do not need await.
        void this.resume();
    }

    private traceContext?: { trackId: number; start: () => void; stop: () => void };
    private async toggleTrace(on: boolean = true) {
        // if cookie is not provided. trace is not usable.
        if (!Configuration.cookie) {
            return;
        }
        if (!on) {
            this.traceContext?.stop();
            return;
        }
        if (this.playingAudio === undefined) return;
        if (this.playingAudio.trackId === this.traceContext?.trackId) {
            this.traceContext.start();
            return;
        }
        this.traceContext?.stop();
        this.traceContext = undefined;
        const startedAt = Date.now();
        const [{ interval }, { token }] = await Promise.all([
            this.sdk.getTraceInterval(),
            this.sdk.getTraceToken({ trackId: this.playingAudio.trackId }),
        ]);

        let sub: vscode.Disposable | undefined = undefined;
        this.traceContext = {
            trackId: this.playingAudio.trackId,
            start: () => {
                if (sub === undefined) {
                    sub = asyncInterval(async () => {
                        if (this.playingTrack) {
                            const params = {
                                trackId: this.playingTrack.trackInfo.trackId,
                                token,
                                startedAt,
                                breakSecond: Math.floor(await this.mpv.getTimePos()),
                                albumId: this.playingTrack.albumInfo.albumId,
                            };
                            await this.sdk.traceStats(params);
                        }
                    }, interval * 1000);
                }
            },
            stop: () => {
                if (sub !== undefined) {
                    sub.dispose();
                    sub = undefined;
                }
            },
        };
        this.traceContext.start();
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
        const generateVols = (value?: number) =>
            [
                this.ctx.get('player.isMuted')
                    ? new QuickPickTreeLeaf('$(unmute)', {
                          description: 'Unmute',
                          alwaysShow: true,
                          onClick: () => {
                              quickPick.hide();
                              void this.toggleMute(false);
                          },
                      })
                    : new QuickPickTreeLeaf('$(mute)', {
                          description: 'Mute',
                          alwaysShow: true,
                          onClick: () => {
                              quickPick.hide();
                              void this.toggleMute(true);
                          },
                      }),
            ].concat(
                value === undefined
                    ? Array.from(
                          { length: 10 },
                          (_, i) =>
                              new QuickPickTreeLeaf('$(symbol-variable)', {
                                  active: (10 - i) * 10 === this.ctx.get('player.volume'),
                                  description: `${(10 - i) * 10}`,
                                  onClick: () => {
                                      quickPick.hide();
                                      void this.mpv.toggleMute(false);
                                      void this.mpv.setVolume((10 - i) * 10);
                                  },
                              })
                      )
                    : new QuickPickTreeLeaf(`$(symbol-variable)`, {
                          description: `${value}`,
                          onClick: () => {
                              quickPick.hide();
                              void this.mpv.toggleMute(false);
                              void this.mpv.setVolume(value);
                          },
                      })
            );
        quickPick.render('Select a option or type an integer between 0 to 100...', generateVols());
        quickPick.onDidChangeValue((value) => {
            const vol = Number(value);
            if (value && !Number.isNaN(vol) && vol >= 0 && vol <= 100) {
                quickPick.repaint(generateVols(vol));
            } else {
                quickPick.repaint(generateVols());
            }
        });
    }

    @command('player.showTrackInfo')
    showTrackInfo() {
        const trackInfo = this.playingTrack?.trackInfo;
        Logger.assert(trackInfo, 'No track found.');
        const items = [
            new QuickPickTreeLeaf('$(history)', {
                description: `${trackInfo.lastUpdate} | ${formatDuration(trackInfo.duration)}`,
            }),
            new QuickPickTreeLeaf('$(account)', {
                description: this.playingTrack!.userInfo.nickname,
                onClick: () => {
                    void vscode.commands.executeCommand(
                        'xmlya.common.showUser',
                        this.quickPick,
                        this.playingTrack!.userInfo.uid
                    );
                },
            }),
            new QuickPickTreeLeaf('$(repo)', {
                description: this.playingTrack!.albumInfo.title,
                onClick: () => {
                    void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
                        title: this.playingTrack!.albumInfo.title,
                        id: this.playingTrack!.albumInfo.albumId,
                    });
                },
            }),
            new QuickPickTreeLeaf('$(cloud-download)', {
                description: 'Download audio source...',
                onClick: () => {
                    this.quickPick.hide();
                    void this.showTrackUrl();
                },
            }),
            new QuickPickTreeLeaf('$(inbox)', {
                description: 'View comments...',
                onClick: () => {
                    void this.viewComments({ trackId: trackInfo.trackId, trackName: trackInfo.title });
                },
            }),
        ];
        this.quickPick.render(trackInfo.title, items);
    }

    @command('player.showPlaylist')
    async showPlayList() {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const items = this.playList.map((item) => {
            if (item.trackId === this.playingAudio?.trackId) {
                return new QuickPickTreeLeaf(item.trackName, {
                    description: formatDuration(item.duration),
                    active: true,
                    onClick: () => {
                        void vscode.commands.executeCommand('xmlya.player.showTrackInfo');
                        quickPick.hide();
                    },
                });
            }
            return new QuickPickTreeLeaf(item.trackName, {
                description: formatDuration(item.duration),
                onClick: () => {
                    quickPick.hide();
                    void this.playTrack(item.trackId, item.albumId);
                },
            });
        });
        if (items.length) {
            quickPick.render('Playlist', items);
        }
    }

    @command('player.showTrackUrl')
    async showTrackUrl({ src, name }: { src?: string; name?: string } = {}) {
        src = src ?? this.playingAudio?.src ?? undefined;
        name = name ?? this.playingTrack?.trackInfo?.title;
        Logger.assert(src, 'Track source is required');
        const choice = await vscode.window.showInformationMessage(src, 'Download', 'Open in Browser');
        if (choice === 'Download') {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.parse(`~/${name ?? 'audio'}.m4a`),
                title: name ?? 'audio',
            });
            if (uri?.fsPath) {
                try {
                    //TODO: report download progress.
                    void vscode.window.withProgress(
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
            void vscode.env.openExternal(vscode.Uri.parse(src));
        }
    }

    @command('player.viewComments')
    async viewComments(
        { trackId, trackName }: { trackId?: number; trackName?: string } = {},
        params?: IPaginator,
        bySelf = false
    ) {
        trackId = trackId ?? this.playingTrack?.trackInfo?.trackId;
        trackName = trackName ?? this.playingTrack?.trackInfo?.title;
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
        const quickPick = new QuickPick({ disposeOnHide: true });
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
    }

    getNowPlaying() {
        if (this.playingAudio === undefined) return undefined;
        return this.playList.find((track) => track.trackId === this.playingAudio?.trackId);
    }

    @command('player.goNext', 'Loading next track...')
    async goNext() {
        const current = this.getNowPlaying();
        Logger.assert(current, 'No track');
        const index = current.index + 1;
        let track = this.playList.find((item) => item.index === index);
        if (!track && this.playContext?.hasMore) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: current.albumId,
                index,
            });
            track = this.playList.find((item) => item.index === index);
        }
        if (track) {
            await this.playTrack(track.trackId, track.albumId);
        } else {
            void vscode.window.showWarningMessage('Failed to get next track');
        }
    }

    @command('player.goPrev', 'Loading previous track...')
    async goPrev() {
        const current = this.getNowPlaying();
        Logger.assert(current, 'No track');
        const index = current.index - 1;
        let track = this.playList.find((item) => item.index === index);
        if (!track && current && current.index > 1) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: current.albumId,
                index,
            });
            track = this.playList.find((item) => item.index === index);
        }
        if (track) {
            await this.playTrack(track.trackId, track.albumId);
        } else {
            void vscode.window.showWarningMessage('Failed to get previous track');
        }
    }

    @command('player.toggleProgress')
    async toggleProgress() {
        if (this.terminal.shown) {
            this.terminal.hide();
            return;
        }
        let sub: vscode.Disposable | undefined;
        this.terminal.event((e) => {
            if (e === TerminalEvents.Hide || e === TerminalEvents.Close) {
                sub?.dispose();
            }
            if (e === TerminalEvents.Show) {
                let writtenLines = 0;
                sub = asyncInterval(async () => {
                    if (writtenLines) {
                        this.terminal.eraseLine(writtenLines);
                        writtenLines = 0;
                    }
                    if (['playing', 'paused', 'seeking'].includes(this.ctx.get<string>('player.readyState')!)) {
                        const pos = Math.floor(await this.mpv.getPercentPosition());
                        this.terminal.appendLine(`Now playing: ${this.playingTrack?.trackInfo?.title}`);
                        this.terminal.append(
                            `${pos}% ${Array.from({ length: 50 }, (_, index) => (index * 2 > pos ? '░' : '█')).join(
                                ''
                            )}`
                        );
                        writtenLines += 2;
                    }
                }, 1000);
            }
        });
        this.terminal.show();
    }
}
