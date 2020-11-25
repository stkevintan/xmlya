import { IPaginator, XmlyaSDK } from '@xmlya/sdk';
import { CtrlButton, QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from './components/quick-pick';
import { FavoritesIcon, PlayHistoryIcon, SubscriptionsIcon } from './lib/constant';
import { command, Runnable } from './runnable';

export class Interactor extends Runnable {
    private quickPick: QuickPick = new QuickPick();
    constructor(private sdk: XmlyaSDK) {
        super(() => {
            this.quickPick.dispose();
        });
    }

    @command('user.playHistory')
    async renderPlayHistory() {
        this.quickPick.loading('Play History');
        const history = await this.sdk.getPlayHistory();
        const manifests = [
            {
                title: 'Today',
                data: history.today,
            },
            {
                title: 'Yesterday',
                data: history.yesterday,
            },
            {
                title: 'Earlier',
                data: history.earlier,
            },
        ] as const;

        this.quickPick.render(
            'Play History',
            manifests.map(
                ({ title, data }) =>
                    new QuickPickTreeParent(title, {
                        description: `(${data.length})`,
                        children: data.map(
                            (entry) =>
                                new QuickPickTreeLeaf(entry.itemTitle, {
                                    description: entry.startedAtFormatText,
                                    detail: entry.childTitle,
                                    action: (picker) => {
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
        this.quickPick.loading('Subscriptions');
        const subscriptions = await this.sdk.getSubscriptions();
        this.quickPick.render(
            'Subscriptions',
            subscriptions.albumsInfo.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        detail: album.description,
                        description: album.subTitle,
                        action: (picker) => {
                            picker.hide();
                        },
                    })
            )
        );
    }

    @command('user.favorites')
    async renderFavorites(params?: IPaginator) {
        this.quickPick.loading('Favorites');
        const favorites = await this.sdk.getFavorites(params);
        this.quickPick.render('Favorites', {
            items: favorites.tracksList.map(
                (track) =>
                    new QuickPickTreeLeaf(track.trackTitle, {
                        description: track.trackDuration,
                        detail: track.albumName,
                    })
            ),
            pagination: favorites,
        });
    }

    @command('user.menu')
    async renderHome() {
        this.quickPick.render(`Menu`, [
            new QuickPickTreeLeaf(`$(${PlayHistoryIcon}) Play History`, { action: () => this.renderPlayHistory() }),
            new QuickPickTreeLeaf(`$(${SubscriptionsIcon}) Subscriptions`, {
                action: () => this.renderSubscriptions(),
            }),
            new QuickPickTreeLeaf(`$(${FavoritesIcon}) Favorites`, {
                action: () => this.renderFavorites({ pageNum: 1, pageSize: 1 }),
            }),
        ]);
    }
}
