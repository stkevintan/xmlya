import { IPaginator } from '@xmlya/sdk';
import { AlbumListEntity, SoarEntity } from '@xmlya/sdk/dist/types/getRecomends';
import { QuickPick, QuickPickTreeLeaf } from 'src/components/quick-pick';
import { ContextService } from 'src/context';
import { PromiseOrNot } from 'src/lib';
import { command, Runnable } from 'src/runnable';
import { window, Disposable, commands } from 'vscode';
import { CategoryTreeDataProvider } from './category';
import { DiscoverTreeDataProvider } from './discover';
import { PlayingWebviewProvider } from './playing';
import { UserTreeDataProvider } from './user';

export class Sidebar extends Runnable {
    private quickPick!: QuickPick;
    private userTreeDataProvider!: UserTreeDataProvider;
    private discoverTreeDataProvider!: DiscoverTreeDataProvider;
    private categoryTreeDataProvider!: CategoryTreeDataProvider;
    private playingWebviewProvider!: PlayingWebviewProvider;

    initialize(context: ContextService): PromiseOrNot<Disposable | undefined> {
        this.quickPick = new QuickPick();

        this.userTreeDataProvider = new UserTreeDataProvider();
        this.discoverTreeDataProvider = new DiscoverTreeDataProvider(this.sdk);
        this.categoryTreeDataProvider = new CategoryTreeDataProvider(this.sdk);
        this.playingWebviewProvider = new PlayingWebviewProvider();

        return Disposable.from(
            this.quickPick,
            window.registerTreeDataProvider('xmlya-user', this.userTreeDataProvider),
            window.registerTreeDataProvider('xmlya-discover', this.discoverTreeDataProvider),
            window.registerTreeDataProvider('xmlya-category', this.categoryTreeDataProvider),
            window.registerWebviewViewProvider('xmlya-playing', this.playingWebviewProvider)
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
                            void commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
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
                            void commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
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
                                void commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
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
    async search() {
        this.quickPick.render('Search');
    }
}
