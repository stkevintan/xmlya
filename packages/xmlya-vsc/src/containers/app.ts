import * as vscode from 'vscode';
import { IAlbum, IPaginator, ISortablePaginator, XmlyaSDK } from '@xmlya/sdk';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import { FavoritesIcon, PlayHistoryIcon, PurchasedIcon, SubscriptionsIcon } from '../lib';
import { command, Runnable } from '../runnable';

export class App extends Runnable {
    private quickPick: QuickPick = new QuickPick();
    constructor(private sdk: XmlyaSDK) {
        super(() => {
            this.quickPick.dispose();
        });
    }

    @command('user.menu')
    async renderHome() {
        this.quickPick.render(`Menu`, [
            new QuickPickTreeLeaf(`$(${PlayHistoryIcon}) Play History`, {
                action: () => this.renderPlayHistory(),
            }),
            new QuickPickTreeLeaf(`$(${SubscriptionsIcon}) Subscriptions`, {
                action: () => this.renderSubscriptions(),
            }),
            new QuickPickTreeLeaf(`$(${FavoritesIcon}) Favorites`, {
                action: () => this.renderFavorites(),
            }),
            new QuickPickTreeLeaf(`$(${PurchasedIcon}) Purchased Albums`, {
                action: () => this.renderPurchasedAlbums(),
            }),
        ]);
    }

    @command('user.playHistory')
    async renderPlayHistory() {
        const title = 'Playing History';
        this.quickPick.loading(title);
        const history = await this.sdk.getPlayHistory();
        const manifests = [
            { title: 'Today', data: history.today },
            { title: 'Yesterday', data: history.yesterday },
            { title: 'Earlier', data: history.earlier },
        ] as const;

        this.quickPick.render(
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
                                    action: async (picker) => {
                                        await vscode.commands.executeCommand(
                                            'xmlya.player.playTrack',
                                            entry.childId,
                                            entry.itemId
                                        );
                                        picker.hide();
                                    },
                                })
                        ),
                    })
            )
        );
    }

    @command('user.subscriptions')
    async renderSubscriptions() {
        const title = 'Subscriptions';
        this.quickPick.loading(title);
        const subscriptions = await this.sdk.getSubscriptions();
        this.quickPick.render(
            title,
            subscriptions.albumsInfo.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        detail: album.description,
                        description: album.subTitle,
                        action: () => {
                            this.renderAlbum(album);
                        },
                    })
            )
        );
    }

    @command('user.favorites')
    async renderFavorites(params?: IPaginator) {
        const title = 'Favorites';
        this.quickPick.loading(title);
        const favorites = await this.sdk.getFavorites(params);
        this.quickPick.render(title, {
            items: favorites.tracksList.map(
                (track) =>
                    new QuickPickTreeLeaf(track.trackTitle, {
                        description: track.trackDuration,
                        detail: track.albumName,
                        action: (picker) => {
                            picker.hide();
                            vscode.commands.executeCommand('xmlya.player.playTrack', track.trackId);
                        },
                    })
            ),
            pagination: favorites,
            onPageChange: (pageNum) => {
                this.renderFavorites({ pageNum, pageSize: params?.pageSize });
            },
        });
    }

    @command('user.purchasedAlbums')
    async renderPurchasedAlbums(params?: IPaginator) {
        const title = 'Purchased Albums';
        this.quickPick.loading(title);
        const albums = await this.sdk.getPurchasedAlbums(params);
        this.quickPick.render(title, {
            items: albums.albumList.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        description: album.subTitle,
                        detail: album.description,
                        action: () => {
                            this.renderAlbum(album);
                        },
                    })
            ),
        });
    }

    async renderAlbum(album: IAlbum, params?: ISortablePaginator) {
        const title = `${album.title} (${album.subTitle})`;
        this.quickPick.loading(title);
        const { tracks, pageNum, pageSize, totalCount, sort } = await this.sdk.getTracksOfAlbum({
            albumId: album.id,
            ...params,
        });
        this.quickPick.render(title, {
            items: tracks.map(
                (track) =>
                    new QuickPickTreeLeaf(track.title, {
                        description: track.createDateFormat,
                        action: (picker) => {
                            picker.hide();
                            vscode.commands.executeCommand('xmlya.player.playTrack', track.trackId, album.id);
                        },
                    })
            ),
            sort,
            pagination: { pageNum, pageSize, totalCount },
            onPageChange: (pageNum) => this.renderAlbum(album, { ...params, pageNum }),
            onSortChange: (sort) => this.renderAlbum(album, { ...params, sort, pageNum: 1 }),
        });
    }
}
