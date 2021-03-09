import { IPaginator, SearchResult, XmlyaSDK } from '@xmlya/sdk';
import { AlbumListEntity, SoarEntity } from '@xmlya/sdk/dist/types/getRecomends';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from 'src/components/quick-pick';
import { ContextService } from 'src/context';
import { command, Runnable } from 'src/runnable';
import { window, Disposable, commands } from 'vscode';
import { CategoryTreeDataProvider } from './category';
import { DiscoverTreeDataProvider } from './discover';
import { PlayingWebviewProvider } from './playing';
import { UserTreeDataProvider } from './user';

type SearchType = Parameters<XmlyaSDK['search']>[0]['core'];

export class Sidebar extends Runnable {
    private quickPick: QuickPick;
    private userTreeDataProvider: UserTreeDataProvider;
    private discoverTreeDataProvider: DiscoverTreeDataProvider;
    private categoryTreeDataProvider: CategoryTreeDataProvider;
    private playingWebviewProvider: PlayingWebviewProvider;

    constructor(sdk: XmlyaSDK, context: ContextService) {
        super(sdk, context);

        this.quickPick = new QuickPick();
        this.userTreeDataProvider = new UserTreeDataProvider();
        this.discoverTreeDataProvider = new DiscoverTreeDataProvider(this.sdk);
        this.categoryTreeDataProvider = new CategoryTreeDataProvider(this.sdk);
        this.playingWebviewProvider = new PlayingWebviewProvider();

        this.register(
            Disposable.from(
                this.quickPick,
                window.registerTreeDataProvider('xmlya-user', this.userTreeDataProvider),
                window.registerTreeDataProvider('xmlya-discover', this.discoverTreeDataProvider),
                window.registerTreeDataProvider('xmlya-category', this.categoryTreeDataProvider),
                window.registerWebviewViewProvider('xmlya-playing', this.playingWebviewProvider)
            )
        );
    }

    @command('sidebar.recommendations')
    async renderRecommends(title: string, albums: AlbumListEntity[]) {
        this.quickPick.render(
            title,
            albums.map(
                (album) =>
                    new QuickPickTreeLeaf(album.albumTitle, {
                        description: `${album.albumPlayCount}`,
                        detail: `${album.albumUserNickName} ${album.intro}`,
                        onClick: () => {
                            void commands.executeCommand('xmlya.player.showAlbumTracks', this.quickPick, {
                                id: album.albumId,
                                title: album.albumTitle,
                            });
                        },
                    })
            )
        );
    }
    @command('sidebar.soar')
    async renderSoar(title: string, albums: SoarEntity[]) {
        this.quickPick.render(
            title,
            albums.map(
                (album) =>
                    new QuickPickTreeLeaf(album.albumTitle, {
                        description: `${album.playCount}`,
                        detail: `${album.anchorName} ${album.tagStr}`,
                        onClick: () => {
                            void commands.executeCommand('xmlya.player.showAlbumTracks', this.quickPick, {
                                id: album.id,
                                title: album.albumTitle,
                            });
                        },
                    })
            )
        );
    }

    @command('category.refresh')
    async refrehCategory() {
        this.categoryTreeDataProvider.refresh();
    }

    @command('discover.refresh')
    async refreshDiscover() {
        this.discoverTreeDataProvider.refresh();
    }

    @command('sidebar.showAlbumsOfCategory')
    async renderAlbumsOfCategory(
        title: string,
        category: string,
        subcategory?: string,
        page?: IPaginator,
        bySelf = false
    ) {
        this.quickPick.loading(title);
        const ret = await this.sdk.getAllAlbumsInCategory({ category, subcategory, ...page });
        this.quickPick.render(
            title,
            {
                items: ret.albums.map(
                    (album) =>
                        new QuickPickTreeLeaf(album.title, {
                            description: `${album.playCount}`,
                            detail: `${album.anchorName}`,
                            onClick: () => {
                                void commands.executeCommand('xmlya.player.showAlbumTracks', this.quickPick, {
                                    id: album.albumId,
                                    title: album.title,
                                });
                            },
                        })
                ),
                pagination: ret,
                onPageChange: (pageNum) =>
                    this.renderAlbumsOfCategory(title, category, subcategory, { ...page, pageNum }, true),
            },
            bySelf ? 'replace' : 'push'
        );
    }

    @command('global.search')
    async search(keyword?: string, type?: SearchType) {
        const quickPick = new QuickPick({ disposeOnHide: true });
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
        paginator?: IPaginator,
        bySelf = false
    ): Promise<void> {
        quickPick.loading(keyword);
        const result = await this.sdk.search({ kw: keyword, core: type, ...paginator });
        const renderAlbums = (album: SearchResult['album']) =>
            album.docs.map(
                (doc) =>
                    new QuickPickTreeLeaf(doc.title, {
                        description: `${doc.playCount} ${doc.nickname}`,
                        detail: doc.customTitle || doc.intro,
                        alwaysShow: true,
                        onClick: (picker) => {
                            void commands.executeCommand('xmlya.player.showAlbumTracks', picker, {
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
                            void commands.executeCommand('xmlya.player.playTrack', doc.id, doc.albumId);
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
                            void commands.executeCommand('xmlya.user.detail', picker, doc.uid);
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
                            void window.showErrorMessage('Not Implemented');
                        },
                    })
            );

        const toScopedResult = <T extends { [key: string]: any }>(
            name: string,
            entry: T,
            render: (doc: T) => QuickPickTreeLeaf[]
        ) =>
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
                        void this.performSearch(quickPick, keyword, type, { ...paginator, pageNum }, true);
                    },
                },
                bySelf ? 'replace' : 'push'
            );

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
    }
}
