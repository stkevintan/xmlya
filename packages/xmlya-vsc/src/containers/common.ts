import * as vscode from 'vscode';
import { IPaginator, ISortablePaginator, SearchResult, XmlyaSDK } from '@xmlya/sdk';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import { command, Runnable } from '../runnable';

type SearchType = Parameters<XmlyaSDK['search']>[0]['core'];

export class Common extends Runnable {
    @command('common.showUserProfile')
    async detail(quickPick: QuickPick, uid: number) {
        if (quickPick === undefined || uid === undefined) return;
        const ret = await quickPick
            .loading()
            .raceWith(Promise.all([this.sdk.getUserInfo({ uid }), this.sdk.getUserPub({ uid })]));
        if (!ret) return;
        const [user, pub] = ret;
        quickPick.render(user.nickName, [
            new QuickPickTreeParent('Profile', {
                children: [
                    new QuickPickTreeLeaf('$(location)', {
                        description: `${user.province} ${user.city}`,
                    }),
                    new QuickPickTreeLeaf('$(telescope)', {
                        description: user.constellationStr,
                    }),
                    new QuickPickTreeLeaf('$(organization)', { description: `${user.fansCount}` }),
                    new QuickPickTreeLeaf('$(symbol-color)', {
                        description: user.personalSignature,
                    }),
                ],
            }),
            new QuickPickTreeParent(`Published Albums`, {
                description: `${pub.pubPageInfo.totalCount}`,
                children: pub.pubPageInfo.pubInfoList.map(
                    (item) =>
                        new QuickPickTreeLeaf(item.title, {
                            description: item.subTitle,
                            detail: `${item.description}`,
                            onClick: () => {
                                quickPick.hide();
                                void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, item);
                            },
                        })
                ),
            }),
            new QuickPickTreeParent('Published Tracks', {
                description: `${pub.trackPageInfo.totalCount}`,
                children: pub.trackPageInfo.trackInfoList.map(
                    (item) =>
                        new QuickPickTreeLeaf(item.title, {
                            description: item.durationAsString,
                            detail: item.albumTitle,
                            onClick: () => {
                                quickPick.hide();
                                void vscode.commands.executeCommand('xmlya.player.play', item.trackId, item.albumId);
                            },
                        })
                ),
            }),
        ]);
    }

    @command('common.showAlbumTracks')
    async showAlbumTracks(quickPick: QuickPick, album: { title: string; id: number }, params?: ISortablePaginator) {
        if (quickPick === undefined || album === undefined) return;
        const render = async (bySelf: boolean, params?: ISortablePaginator) => {
            const title = `${album.title}`;
            const ret = await quickPick.loading(title).raceWith(
                this.sdk.getTracksOfAlbum({
                    albumId: album.id,
                    ...params,
                })
            );
            if (!ret) return;
            const { tracks, pageNum, pageSize, totalCount, sort } = ret;
            quickPick.render(
                title,
                {
                    items: tracks.map(
                        (track) =>
                            new QuickPickTreeLeaf(track.title, {
                                description: track.createDateFormat,
                                onClick: (picker) => {
                                    picker.hide();
                                    void vscode.commands.executeCommand('xmlya.player.play', track.trackId, album.id);
                                },
                            })
                    ),
                    sort,
                    pagination: { pageNum, pageSize, totalCount },
                    onPageChange: (pageNum) => render(true, { ...params, pageNum }),
                    onSortChange: (sort) => render(true, { ...params, pageNum: 1, sort }),
                },
                bySelf ? 'replace' : 'push'
            );
        };
        await render(false, params);
    }

    @command('common.search')
    async search(keyword?: string, type?: SearchType) {
        const quickPick = new QuickPick({ disposeOnHide: true, ignoreFocusOut: true });
        const toOptions = (type: SearchType) =>
            new QuickPickTreeLeaf('$(search)', {
                description: `Search in ${type}`,
                alwaysShow: true,
                onClick: () => {
                    if (quickPick.value.length >= 1) {
                        void this.performSearch(quickPick, quickPick.value, type);
                    }
                },
            });
        const searchOptions = (<SearchType[]>['all', 'album', 'track', 'user', 'live']).map(toOptions);

        quickPick.onDidChangeValue(() => {
            quickPick.repaint(searchOptions);
        });
        if (keyword) {
            await this.performSearch(quickPick, keyword, type);
        } else {
            quickPick.render('Type keywords to search...', searchOptions);
        }
    }

    private async performSearch(
        quickPick: QuickPick,
        keyword: string,
        type: SearchType = 'all',
        page?: IPaginator
    ): Promise<void> {
        const outerRender = async (bySelf: boolean, page?: IPaginator) => {
            const result = await quickPick
                .loading(keyword)
                .raceWith(this.sdk.search({ kw: keyword, core: type, ...page }));
            if (!result) return;
            const renderAlbums = (album: SearchResult['album']) =>
                album.docs.map(
                    (doc) =>
                        new QuickPickTreeLeaf(doc.title, {
                            description: `${doc.playCount} ${doc.nickname}`,
                            detail: doc.customTitle || doc.intro,
                            alwaysShow: true,
                            onClick: () => {
                                void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, {
                                    title: doc.title,
                                    id: doc.albumId,
                                });
                            },
                        })
                );

            const renderTracks = (track: SearchResult['track']) =>
                track.docs.map(
                    (doc) =>
                        new QuickPickTreeLeaf(doc.title, {
                            description: `${doc.playCount} ${doc.nickname}`,
                            detail: doc.albumTitle,
                            alwaysShow: true,
                            onClick: () => {
                                void vscode.commands.executeCommand('xmlya.player.play', doc.id, doc.albumId);
                            },
                        })
                );

            const renderUsers = (user: SearchResult['user']) =>
                user.docs.map(
                    (doc) =>
                        new QuickPickTreeLeaf(doc.nickname, {
                            description: `LV${doc.anchorGrade}`,
                            detail: `tracks: ${doc.tracksCount}, followers: ${doc.followersCount}, followings: ${doc.followingsCount}`,
                            alwaysShow: true,
                            onClick: (picker) => {
                                void vscode.commands.executeCommand('xmlya.common.showUserProfile', picker, doc.uid);
                            },
                        })
                );

            const renderLives = (live: SearchResult['live']) =>
                live.docs.map(
                    (doc) =>
                        new QuickPickTreeLeaf(doc.title, {
                            description: `${doc.playCount}`,
                            detail: doc.unrichProgramName,
                            alwaysShow: true,
                            onClick: (picker) => {
                                picker.dispose();
                                void vscode.window.showErrorMessage('Not Implemented');
                            },
                        })
                );

            const toScopedResult = <T extends { [key: string]: any }>(
                name: string,
                entry: T,
                render: (doc: T) => QuickPickTreeLeaf[]
            ) => {
                quickPick.render(
                    `${name}: ${keyword}`,
                    {
                        items: render(entry),
                        pagination: {
                            pageNum: entry.currentPage,
                            pageSize: entry.pageSize,
                            totalCount: entry.total,
                        },
                        onPageChange: (pageNum) => {
                            void outerRender(true, { ...page, pageNum });
                        },
                    },
                    bySelf ? 'replace' : 'push'
                );
            };

            switch (type) {
                case 'all':
                    quickPick.render(
                        keyword,
                        [
                            !!result.album &&
                                new QuickPickTreeParent('Album', {
                                    description: `${result.album.total}`,
                                    children: renderAlbums(result.album),
                                }),
                            !!result.track &&
                                new QuickPickTreeParent('Track', {
                                    description: `${result.track.total}`,
                                    children: renderTracks(result.track),
                                }),
                            !!result.user &&
                                new QuickPickTreeParent('User', {
                                    description: `${result.user.total}`,
                                    children: renderUsers(result.user),
                                }),
                            !!result.live &&
                                new QuickPickTreeParent('Live', {
                                    description: `${result.live.total}`,
                                    children: renderLives(result.live),
                                }),
                        ].filter((x) => x)
                    );
                    break;
                case 'album':
                    toScopedResult('Album', result.album, renderAlbums);
                    break;
                case 'track':
                    toScopedResult('Track', result.track, renderTracks);
                    break;
                case 'user':
                    toScopedResult('User', result.user, renderUsers);
                    break;
                case 'live':
                    toScopedResult('Live', result.live, renderLives);
                    break;
            }
        };
        await outerRender(false, page);
    }
}
