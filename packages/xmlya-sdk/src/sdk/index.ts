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
    IUserPub,
    IUserInfo,
} from '../types';
import { IClient } from './client';
import { decodeNonFreeAudioSrc } from '../lib/decoder';
import { assert } from 'console';

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

    // user publish info
    getUserPublish = async (params: { uid: number }): Promise<IUserPub> => {
        const ret = await this.client.get<IUserPub>('revision/user', params);
        return ret;
    };

    getUserInfo = async (params: { uid: number }): Promise<IUserInfo> => {
        return await this.client.get('revision/user/basic', params);
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
                th_engine: 'encrypt',
                isBackend: false,
            },
            {
                headers: {
                    Host: 'mpay.ximalaya.com',
                },
                prefixUrl: 'https://mpay.ximalaya.com',
            }
        );
    };

    getNonFreeTrackAudioSrc = async (params: { trackId: number }): Promise<string> => {
        const audio = await this.getNonFreeTrackAudio(params);
        return await decodeNonFreeAudioSrc(audio);
    };

    getContextTracks = (
        params:
            | { albumId: number; index: number; sort?: SortOrder; size?: number }
            | { trackId: number; sort?: SortOrder; size?: number }
    ) => {
        const sort = params.sort ?? SortOrder.asc;
        const size = params.size ?? 30;
        if ('albumId' in params) {
            return this.client.get<IContextTracks>('revision/play/v1/show', {
                id: params.albumId,
                num: Math.ceil(params.index / size),
                sort,
                size,
                ptype: 0,
            });
        }
        return this.client.get<IContextTracks>('revision/play/v1/show', {
            id: params.trackId,
            sort,
            size,
            ptype: 1,
        });
    };

    getTraceToken = (params: { trackId: number }) => {
        return this.client.post<{ token: string }>('nyx/v2/track/count/web', params);
    };

    getServerTime = (): Promise<number> => {
        return this.client.getRaw('revision/time') as any;
    };

    getTraceInterval = async (): Promise<{ interval: number }> => {
        return await this.client.get<{ interval: number }>('nyx/v2/track/statistic/interval');
    };

    traceStats = async (params: {
        trackId: number;
        albumId: number;
        startedAt: number;
        endedAt?: number;
        breakSecond: number;
        token: string;
    }): Promise<void> => {
        const endedAt = params.endedAt ?? Date.now();
        return await this.client.post<void>('nyx/v2/track/statistic/web', {
            ...params,
            direction: 0,
            endedAt,
            duration: Math.floor((endedAt - params.startedAt) / 1000),
        });
    };

    download = async (url: string) => {
        return await this.client.getStream(url);
    };
}
