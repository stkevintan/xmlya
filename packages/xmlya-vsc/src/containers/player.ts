import * as vscode from 'vscode';
import { command, Runnable } from '../runnable';
import { GetContextTracksResult, GetTrackAudioResult, IPaginator, ISortablePaginator, XmlyaSDK } from '@xmlya/sdk';
import { Notification } from '../lib/logger';
import { Configuration } from '../configuration';
import { StatusBar } from '../components/status-bar';
import { asyncInterval, formatDuration } from '../lib';
import { Mpv } from '@xmlya/mpv';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import controls from '../playctrls.json';
import { ContextService } from 'src/context';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import assert from 'assert';
const pipe = promisify(pipeline);

export class Player extends Runnable {
    private quickPick: QuickPick = new QuickPick();

    private playingAudio?: GetTrackAudioResult;
    private playContext?: GetContextTracksResult;

    get playlist() {
        return this.playContext?.tracksAudioPlay ?? [];
    }

    get playingTrack() {
        return this.playlist.find((track) => this.playingAudio?.trackId === track.trackId);
    }

    constructor(private mpv: Mpv, sdk: XmlyaSDK, context: ContextService) {
        super(sdk, context);

        // construct the status bar.
        const statusBar = new StatusBar(controls, Configuration.statusBarItemBase);
        // render in current context
        statusBar.renderWith(context, 'player');
        // start trace
        const traceRef = this.context.onChange((keys) => {
            if (keys.includes('player.readyState')) {
                void this.toggleTrace(this.context.get('player.readyState') === 'playing');
            }
        });

        this.register(
            vscode.Disposable.from(statusBar, this.quickPick, traceRef, {
                dispose: () => this.traceContext?.start(),
            })
        );
    }

    @command('player.play', 'Loading track...')
    async play(trackId: number, albumId: number) {
        if (trackId === undefined || albumId === undefined) return;
        this.playingAudio = await this.sdk.getTrackAudio({ trackId });
        Notification.assert(this.playingAudio, 'No track to play.');
        // if playContext is outdated.
        if (this.playContext === undefined || this.playingTrack?.albumId !== albumId) {
            this.playContext = await this.sdk.getContextTracks({ trackId });
        }
        assert(this.playingTrack, 'no track to play');
        this.context.set({
            'player.trackTitle': this.playingTrack.trackName,
            'player.trackAlbum': this.playingTrack.albumName,
            'player.trackDuration': this.playingTrack.duration,
            'player.trackCover': `https://imagev2.xmcdn.com/${this.playingTrack.trackCoverPath}`,
        });

        const index = this.playlist.findIndex((item) => item.trackId === this.playingAudio?.trackId);
        if (index !== -1) {
            this.context.set('player.hasPrev', index > 0 || this.playlist[0].index !== 1);
            this.context.set('player.hasNext', index < this.playlist.length - 1 || this.playContext!.hasMore);
        } else {
            this.context.set('player.hasPrev', false);
            this.context.set('player.hasnext', false);
        }
        // set loading state ahead of time.
        try {
            this.context.set('player.readyState', 'loading');
            if (!this.playingAudio.src) {
                Notification.assertTrue(
                    this.playingAudio.canPlay,
                    `Track ${this.playingTrack.trackName} is not playable.`
                );
                this.playingAudio.src = await this.sdk.getNonFreeTrackAudioSrc({ trackId: this.playingAudio.trackId });
            }

            Notification.assert(this.playingAudio.src, 'Get audio source failed');
        } catch (e) {
            this.context.set('player.readyState', 'error');
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
                                trackId: this.playingTrack.trackId,
                                token,
                                startedAt,
                                breakSecond: Math.floor(await this.mpv.getTimePos()),
                                albumId: this.playingTrack.albumId,
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
                this.context.get('player.isMuted')
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
                                  active: (10 - i) * 10 === this.context.get('player.volume'),
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
    async showTrackInfo() {
        Notification.assert(this.playingTrack, 'No track found.');
        this.quickPick.loading(this.playingTrack.trackName);
        const info = await this.sdk.getTrackPageInfo({ trackId: this.playingTrack.trackId });
        const items = [
            new QuickPickTreeLeaf('$(history)', {
                description: `${this.playingTrack.updateTime} | ${formatDuration(this.playingTrack.duration)}`,
            }),
            new QuickPickTreeLeaf('$(account)', {
                description: info.userInfo.nickname,
                onClick: () => {
                    void vscode.commands.executeCommand(
                        'xmlya.common.showUserProfile',
                        this.quickPick,
                        info.userInfo.uid
                    );
                },
            }),
            new QuickPickTreeLeaf('$(repo)', {
                description: info.albumInfo.title,
                onClick: () => {
                    void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
                        title: info.albumInfo.title,
                        id: info.albumInfo.albumId,
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
                    void this.viewComments({ trackId: info.trackInfo.trackId, trackName: info.trackInfo.title });
                },
            }),
        ];
        this.quickPick.render(info.trackInfo.title, items);
    }

    @command('player.showPlaylist')
    async showPlayList() {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const items = this.playlist.map((item) => {
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
                    void this.play(item.trackId, item.albumId);
                },
            });
        });
        quickPick.render('Playlist', items);
    }

    @command('player.showTrackUrl')
    async showTrackUrl({ src, name }: { src?: string; name?: string } = {}) {
        src = src ?? this.playingAudio?.src ?? undefined;
        name = name ?? this.playingTrack?.trackName ?? 'audio';
        Notification.assert(src, 'Track source is required');
        const choice = await vscode.window.showInformationMessage(src, 'Download', 'Open in Browser');
        if (choice === 'Download') {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.parse(`~/${name}.m4a`),
                title: name,
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
                    Notification.throw(e);
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
        trackId = trackId ?? this.playingTrack?.trackId;
        trackName = trackName ?? this.playingTrack?.trackName;
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
                        active: this.context.get('player.speed') === speed,
                        description: `${speed}x`,
                        onClick: async (picker) => {
                            picker.hide();
                            await this.mpv.setSpeed(speed);
                        },
                    })
            )
        );
    }

    @command('player.goNext', 'Loading next track...')
    async goNext() {
        const current = this.playingTrack;
        Notification.assert(current, 'No track');
        const index = current.index + 1;
        let track = this.playlist.find((item) => item.index === index);
        if (!track && this.playContext?.hasMore) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: current.albumId,
                index,
            });
            track = this.playlist.find((item) => item.index === index);
        }
        if (track) {
            await this.play(track.trackId, track.albumId);
        } else {
            void vscode.window.showWarningMessage('Already the last track');
        }
    }

    @command('player.goPrev', 'Loading previous track...')
    async goPrev() {
        const current = this.playingTrack;
        Notification.assert(current, 'No track');
        const index = current.index - 1;
        let track = this.playlist.find((item) => item.index === index);
        if (!track && current && current.index > 1) {
            this.playContext = await this.sdk.getContextTracks({
                albumId: current.albumId,
                index,
            });
            track = this.playlist.find((item) => item.index === index);
        }
        if (track) {
            await this.play(track.trackId, track.albumId);
        } else {
            void vscode.window.showWarningMessage('Already the first track');
        }
    }
}
