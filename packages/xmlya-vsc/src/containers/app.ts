import * as vscode from 'vscode';
import { IPaginator } from '@xmlya/sdk';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from '../components/quick-pick';
import { FavoritesIcon, PlayHistoryIcon, PurchasedIcon, SubscriptionsIcon } from '../lib';
import { command, Runnable } from '../runnable';

export class App extends Runnable {
    private quickPick!: QuickPick;

    initialize() {
        this.quickPick = new QuickPick();
        return this.quickPick;
    }

    @command('user.menu')
    async renderHome() {
        this.quickPick.render(`Menu`, [
            new QuickPickTreeLeaf(`$(${PlayHistoryIcon}) Play History`, {
                onClick: () => this.renderPlayHistory(),
            }),
            new QuickPickTreeLeaf(`$(${SubscriptionsIcon}) Subscriptions`, {
                onClick: () => this.renderSubscriptions(),
            }),
            new QuickPickTreeLeaf(`$(${FavoritesIcon}) Favorites`, {
                onClick: () => this.renderFavorites(),
            }),
            new QuickPickTreeLeaf(`$(${PurchasedIcon}) Purchased Albums`, {
                onClick: () => this.renderPurchasedAlbums(),
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
                                    onClick: async (picker) => {
                                        picker.hide();
                                        void vscode.commands.executeCommand(
                                            'xmlya.player.playTrack',
                                            entry.childId,
                                            entry.itemId
                                        );
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
                        onClick: () => {
                            void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, album);
                        },
                    })
            )
        );
    }

    @command('user.favorites')
    async renderFavorites(params?: IPaginator, bySelf = false) {
        const title = 'Favorites';
        this.quickPick.loading(title);
        const favorites = await this.sdk.getFavorites(params);
        this.quickPick.render(
            title,
            {
                items: favorites.tracksList.map(
                    (track) =>
                        new QuickPickTreeLeaf(track.trackTitle, {
                            description: track.trackDuration,
                            detail: track.albumName,
                            onClick: (picker) => {
                                picker.hide();
                                void vscode.commands.executeCommand('xmlya.player.playTrack', track.trackId);
                            },
                        })
                ),
                pagination: favorites,
                onPageChange: (pageNum) => {
                    void this.renderFavorites({ pageNum, pageSize: params?.pageSize }, true);
                },
            },
            bySelf ? 'replace' : 'push'
        );
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
                        onClick: () => {
                            void vscode.commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, album);
                        },
                    })
            ),
        });
    }
}
