import {
    IAlbumDetail,
    ICommentsInTrack,
    IContextTracks,
    ICurrentUser,
    IFavorites,
    IPlayHistory,
    INonFreeTrackAudio,
    IPaginator,
    IPurchasedAlbums,
    ISubscriptions,
    ITrackAudio,
    ITracksInAlbum,
    SortOrder,
    ISortablePaginator,
} from '../types';
import { IClient } from './client';
import { decodeNonFreeAudioSrc } from '../lib/decoder';

export class XmlyaSDK {
    constructor(private client: IClient) {}

    // my
    getCurrentUser = () => this.client.get<ICurrentUser>('revision/main/getCurrentUser');

    getPlayHistory = (params?: IPaginator & { includeChannel?: boolean; includeRadio?: boolean }) =>
        this.client.get<IPlayHistory>('revision/track/history/listen', params);

    getSubscriptions = (params?: IPaginator & { subType?: number; category?: string }) => {
        const { pageNum: num, pageSize: size, ...rest } = params ?? {};
        return this.client.get<ISubscriptions>('revision/album/v1/sub/comprehensive', {
            subType: 2,
            category: 'all',
            num,
            size,
            ...rest,
        });
    };

    getFavorites = (params?: IPaginator) => this.client.get<IFavorites>('revision/my/getLikeTracks', params);

    getPurchasedAlbums = (params?: IPaginator) =>
        this.client.get<IPurchasedAlbums>('revision/my/getHasBroughtAlbums', params);

    // albums
    getAlbumWithTracks = async (params: { albumId: number }): Promise<IAlbumDetail> => {
        const ret = await this.client.get<IAlbumDetail>('revision/album', params);
        // rename trackTotalCount to totalCount
        ret.tracksInfo.totalCount = (ret.tracksInfo as any).trackTotalCount;
        return ret;
    };

    getTracksOfAlbum = async (params: ISortablePaginator & { albumId: number }): Promise<ITracksInAlbum> => {
        const ret = await this.client.get<any>('revision/album/v1/getTracksList', params);
        return {
            totalCount: ret.trackTotalCount,
            ...ret,
        };
    };

    // track - youshengshu
    getCommentsOfTrack = async (params: IPaginator & { trackId: number }): Promise<ICommentsInTrack> => {
        const { pageNum: page = 1, pageSize = 20, ...rest } = params;
        const ret = await this.client.get<any>('revision/comment/queryComments', { page, pageSize, ...rest });
        return {
            pageNum: ret.currentPage,
            totalCount: ret.totalComment,
            ...ret,
        };
    };

    // src will be null when audio is nonfree
    getTrackAudio = (params: { trackId: number }) =>
        this.client.get<ITrackAudio>('revision/play/v1/audio', { id: params.trackId, ptype: 1 });

    getNonFreeTrackAudio = (params: { trackId: number }) => {
        return this.client.getRaw<void, INonFreeTrackAudio>(
            `mobile/track/pay/${params.trackId}/ts-${Date.now()}`,
            {
                trackQualityLevel: 0,
                device: 'pc',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                th_engine: 'encrypt',
                isBackend: false,
            },
            {
                headers: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Host: 'mpay.ximalaya.com',
                },
                prefixUrl: 'https://mpay.ximalaya.com',
            }
        );
    };

    getTrackAudioSrc = async (params: { trackId: number }): Promise<string> => {
        const audio1 = await this.getTrackAudio(params);
        if (audio1.src) {
            return audio1.src;
        }
        const audio2 = await this.getNonFreeTrackAudio(params);
        return await decodeNonFreeAudioSrc(audio2);
    };

    getContextTracks = (params: { trackId: number; sort?: SortOrder; size?: number }) => {
        return this.client.get<IContextTracks>('revision/play/v1/show', {
            id: params.trackId,
            size: params.size ?? 30,
            ptype: 1,
            sort: params.sort ?? SortOrder.asc,
        });
    };
}
