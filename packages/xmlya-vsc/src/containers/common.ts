import { ISortablePaginator } from '@xmlya/sdk';
import { QuickPick, QuickPickTreeLeaf, QuickPickTreeParent } from 'src/components/quick-pick';
import { command, Runnable } from 'src/runnable';
import { commands, Disposable } from 'vscode';

interface IAlbumProp {
    title: string;
    id: number;
    subTitle: string;
}
export class Common extends Runnable {
    initialize() {
        return undefined;
    }

    @command('common.showAlbumTracks')
    async showAlbumTracks(quickPick: QuickPick, album: IAlbumProp, params?: ISortablePaginator, bySelf = false) {
        if (quickPick === undefined || album === undefined) return;
        const title = `${album.title} (${album.subTitle})`;
        quickPick.loading(title);
        const { tracks, pageNum, pageSize, totalCount, sort } = await this.sdk.getTracksOfAlbum({
            albumId: album.id,
            ...params,
        });
        quickPick.render(
            title,
            {
                items: tracks.map(
                    (track) =>
                        new QuickPickTreeLeaf(track.title, {
                            description: track.createDateFormat,
                            onClick: (picker) => {
                                picker.hide();
                                commands.executeCommand('xmlya.player.playTrack', track.trackId, album.id);
                            },
                        })
                ),
                sort,
                pagination: { pageNum, pageSize, totalCount },
                onPageChange: (pageNum) => this.showAlbumTracks(quickPick, album, { ...params, pageNum }, true),
                onSortChange: (sort) => this.showAlbumTracks(quickPick, album, { ...params, sort, pageNum: 1 }, true),
            },
            bySelf ? 'replace' : 'push'
        );
    }

    @command('common.showUser')
    async showUser(quickPick: QuickPick, uid: number) {
        if (quickPick === undefined || uid === undefined) return;
        quickPick.loading('...');
        const [user, pub] = await Promise.all([this.sdk.getUserInfo({ uid }), this.sdk.getUserPublish({ uid })]);
        quickPick.render(user.nickName, [
            new QuickPickTreeParent('Basic info', {
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
                                this.showAlbumTracks(quickPick, item);
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
                                commands.executeCommand('xmlya.player.playTrack', item.trackId, item.albumId);
                            },
                        })
                ),
            }),
        ]);
    }
}
