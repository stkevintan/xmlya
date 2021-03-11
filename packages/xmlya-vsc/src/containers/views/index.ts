import { Mpv } from '@xmlya/mpv';
import { IPaginator, XmlyaSDK } from '@xmlya/sdk';
import { AlbumListEntity, SoarEntity } from '@xmlya/sdk/dist/types/getRecomends';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from 'src/components/quick-pick';
import { ContextService } from 'src/context';
import { command, Runnable } from 'src/runnable';
import { window, Disposable, commands } from 'vscode';
import { CategoryTreeDataProvider } from './category';
import { DiscoverTreeDataProvider } from './discover';
import { PlayingWebviewProvider } from './playing';
import { UserTreeDataProvider } from './user';

export class View extends Runnable {
    private userTreeDataProvider: UserTreeDataProvider;
    private discoverTreeDataProvider: DiscoverTreeDataProvider;
    private categoryTreeDataProvider: CategoryTreeDataProvider;
    private playingWebviewProvider: PlayingWebviewProvider;

    constructor(private mpv: Mpv, sdk: XmlyaSDK, context: ContextService) {
        super(sdk, context);

        this.userTreeDataProvider = new UserTreeDataProvider();
        this.discoverTreeDataProvider = new DiscoverTreeDataProvider(this.sdk);
        this.categoryTreeDataProvider = new CategoryTreeDataProvider(this.sdk);
        this.playingWebviewProvider = new PlayingWebviewProvider(this.mpv, context);

        this.register(
            Disposable.from(
                window.registerTreeDataProvider('xmlya-user', this.userTreeDataProvider),
                window.registerTreeDataProvider('xmlya-discover', this.discoverTreeDataProvider),
                window.registerTreeDataProvider('xmlya-category', this.categoryTreeDataProvider),
                window.registerWebviewViewProvider('xmlya-playing', this.playingWebviewProvider)
            )
        );
    }

    @command('discover.recommendations')
    renderRecommends(title: string, albums: AlbumListEntity[]) {
        const quickPick = new QuickPick({ disposeOnHide: true });
        quickPick.render(
            title,
            albums.map(
                (album) =>
                    new QuickPickTreeLeaf(album.albumTitle, {
                        description: `${album.albumPlayCount}`,
                        detail: `${album.albumUserNickName} ${album.intro}`,
                        onClick: () => {
                            void commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, {
                                id: album.albumId,
                                title: album.albumTitle,
                            });
                        },
                    })
            )
        );
    }

    @command('discover.soar')
    renderSoar(title: string, albums: SoarEntity[]) {
        const quickPick = new QuickPick({ disposeOnHide: true });
        quickPick.render(
            title,
            albums.map(
                (album) =>
                    new QuickPickTreeLeaf(album.albumTitle, {
                        description: `${album.playCount}`,
                        detail: `${album.anchorName} ${album.tagStr}`,
                        onClick: () => {
                            void commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, {
                                id: album.id,
                                title: album.albumTitle,
                            });
                        },
                    })
            )
        );
    }

    @command('category.showAlbumsOfCategory')
    async renderAlbumsOfCategory(title: string, category: string, subcategory?: string, page?: IPaginator) {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const render = async (bySelf: boolean, page?: IPaginator) => {
            const ret = await quickPick
                .loading(title)
                .raceWith(this.sdk.getAllAlbumsInCategory({ category, subcategory, ...page }));
            if (!ret) return;
            quickPick.render(
                title,
                {
                    items: ret.albums.map(
                        (album) =>
                            new QuickPickTreeLeaf(album.title, {
                                description: `${album.playCount}`,
                                detail: `${album.anchorName}`,
                                onClick: () => {
                                    void commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, {
                                        id: album.albumId,
                                        title: album.title,
                                    });
                                },
                            })
                    ),
                    pagination: ret,
                    onPageChange: (pageNum) => render(true, { ...page, pageNum }),
                },
                bySelf ? 'replace' : 'push'
            );
        };
        await render(false, page);
    }

    @command('user.playHistory')
    async renderPlayHistory() {
        const title = 'Playing History';
        const quickPick = new QuickPick({ disposeOnHide: true });
        const history = await quickPick.loading(title).raceWith(this.sdk.getPlayHistory());
        if (!history) return;
        const manifests = [
            { title: 'Today', data: history.today },
            { title: 'Yesterday', data: history.yesterday },
            { title: 'Earlier', data: history.earlier },
        ] as const;

        quickPick.render(
            title,
            manifests.map(
                ({ title, data }) =>
                    new QuickPickTreeParent(title, {
                        description: `(${data.length})`,
                        children: data.map(
                            (entry) =>
                                new QuickPickTreeLeaf(entry.itemTitle, {
                                    description: entry.startedAtFormatText,
                                    detail: entry.childTitle,
                                    onClick: async (picker) => {
                                        picker.hide();
                                        void commands.executeCommand('xmlya.player.play', entry.childId, entry.itemId);
                                    },
                                })
                        ),
                    })
            )
        );
    }

    @command('user.subscriptions')
    async renderSubscriptions() {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const title = 'Subscriptions';
        const subscriptions = await quickPick.loading(title).raceWith(this.sdk.getSubscriptions());
        if (!subscriptions) return;
        quickPick.render(
            title,
            subscriptions.albumsInfo.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        detail: album.description,
                        description: album.subTitle,
                        onClick: () => {
                            void commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, album);
                        },
                    })
            )
        );
    }

    @command('user.favorites')
    async renderFavorites(page?: IPaginator) {
        const quickPick = new QuickPick({ disposeOnHide: true });
        const render = async (bySelf: boolean, params?: IPaginator) => {
            const title = 'Favorites';
            const favorites = await quickPick.loading(title).raceWith(this.sdk.getFavorites(params));
            if (!favorites) return;
            quickPick.render(
                title,
                {
                    items: favorites.tracksList.map(
                        (track) =>
                            new QuickPickTreeLeaf(track.trackTitle, {
                                description: track.trackDuration,
                                detail: track.albumName,
                                onClick: (picker) => {
                                    picker.hide();
                                    void commands.executeCommand('xmlya.player.play', track.trackId);
                                },
                            })
                    ),
                    pagination: favorites,
                    onPageChange: (pageNum) => {
                        void render(true, { pageNum, pageSize: params?.pageSize });
                    },
                },
                bySelf ? 'replace' : 'push'
            );
        };
        await render(false, page);
    }

    @command('user.purchasedAlbums')
    async renderPurchasedAlbums(params?: IPaginator) {
        const title = 'Purchased Albums';
        const quickPick = new QuickPick({ disposeOnHide: true });
        const albums = await quickPick.loading(title).raceWith(this.sdk.getPurchasedAlbums(params));
        if (!albums) return;
        quickPick.render(title, {
            items: albums.albumList.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        description: album.subTitle,
                        detail: album.description,
                        onClick: () => {
                            void commands.executeCommand('xmlya.common.showAlbumTracks', quickPick, album);
                        },
                    })
            ),
        });
    }

    @command('category.refresh')
    async refrehCategory() {
        this.categoryTreeDataProvider.refresh();
    }

    @command('discover.refresh')
    async refreshDiscover() {
        this.discoverTreeDataProvider.refresh();
    }

    @command('playing.refresh')
    async refreshPlaying() {
        this.playingWebviewProvider.refresh();
    }
}
