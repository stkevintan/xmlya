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
    initialize(context: ContextService): PromiseOrNot<Disposable | undefined> {
        this.quickPick = new QuickPick();
        return Disposable.from(
            this.quickPick,
            window.registerTreeDataProvider('xmlya-user', new UserTreeDataProvider()),
            window.registerTreeDataProvider('xmlya-discover', new DiscoverTreeDataProvider(this.sdk)),
            window.registerTreeDataProvider('xmlya-category', new CategoryTreeDataProvider(this.sdk)),
            window.registerWebviewViewProvider('xmlya-playing', new PlayingWebviewProvider())
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
                            this.quickPick.hide();
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
                            this.quickPick.hide();
                            void commands.executeCommand('xmlya.common.showAlbumTracks', this.quickPick, {
                                id: album.id,
                                title: album.albumTitle,
                            });
                        },
                    })
            )
        );
    }
}
