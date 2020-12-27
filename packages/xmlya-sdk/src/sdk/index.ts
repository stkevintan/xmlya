import {
    GetCurrentUserResult,
    GetFavoritesResult,
    GetPlayHistoryResult,
    GetPurchasedAlbumsResult,
    GetSubscriptionsResult,
    GetTrackPageInfoResult,
    GetAlbumWithTracksResult,
    IPaginator,
    GetUserPubResult,
    GetUserInfoResult,
    ISortablePaginator,
    GetTracksOfAlbumResult,
    GetCommentsOfTracksResult,
    GetTrackAudioResult,
    GetNonFreeTrackAudioResult,
    SortOrder,
    GetContextTracksResult,
} from '../types';
import { IClient } from './client';
import { decodeNonFreeAudioSrc } from '../lib/decoder';

export class XmlyaSDK {
    constructor(private client: IClient) {}

    // my
    getCurrentUser = () => this.client.get<GetCurrentUserResult>('revision/main/getCurrentUser');

    getPlayHistory = (params?: IPaginator & { includeChannel?: boolean; includeRadio?: boolean }) =>
        this.client.get<GetPlayHistoryResult>('revision/track/history/listen', params);

    getSubscriptions = (params?: IPaginator & { subType?: number; category?: string }) => {
        const { pageNum: num, pageSize: size, ...rest } = params ?? {};
        return this.client.get<GetSubscriptionsResult>('revision/album/v1/sub/comprehensive', {
            subType: 2,
            category: 'all',
            num,
            size,
            ...rest,
        });
    };

    getFavorites = (params?: IPaginator) => this.client.get<GetFavoritesResult>('revision/my/getLikeTracks', params);

    getPurchasedAlbums = (params?: IPaginator) =>
        this.client.get<GetPurchasedAlbumsResult>('revision/my/getHasBroughtAlbums', params);

    // albums
    getAlbumWithTracks = async (params: { albumId: number }) => {
        const ret = await this.client.get<GetAlbumWithTracksResult>('revision/album', params);
        // rename trackTotalCount to totalCount
        ret.tracksInfo.totalCount = ret.tracksInfo.trackTotalCount;
        return ret;
    };

    // user public info
    getUserPub = async (params: { uid: number }) => {
        const ret = await this.client.get<GetUserPubResult>('revision/user', params);
        return ret;
    };

    getUserInfo = async (params: { uid: number }) => {
        return await this.client.get<GetUserInfoResult>('revision/user/basic', params);
    };

    getTracksOfAlbum = async (params: ISortablePaginator & { albumId: number }) => {
        const ret = await this.client.get<GetTracksOfAlbumResult>('revision/album/v1/getTracksList', params);
        ret.totalCount = ret.trackTotalCount;
        return ret;
    };

    getTrackPageInfo = async (params: { trackId: number }) => {
        return await this.client.get<GetTrackPageInfoResult>('revision/track/trackPageInfo', params);
    };

    // track - youshengshu
    getCommentsOfTrack = async (params: IPaginator & { trackId: number }) => {
        const { pageNum: page = 1, pageSize = 20, ...rest } = params;
        const ret = await this.client.get<GetCommentsOfTracksResult>('revision/comment/queryComments', {
            page,
            pageSize,
            ...rest,
        });
        return {
            pageNum: ret.currentPage,
            totalCount: ret.totalComment,
            ...ret,
        };
    };

    // src will be null when audio is nonfree
    getTrackAudio = (params: { trackId: number }) =>
        this.client.get<GetTrackAudioResult>('revision/play/v1/audio', { id: params.trackId, ptype: 1 });

    getNonFreeTrackAudio = (params: { trackId: number }) => {
        return this.client.getRaw<void, GetNonFreeTrackAudioResult>(
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
            return this.client.get<GetContextTracksResult>('revision/play/v1/show', {
                id: params.albumId,
                num: Math.ceil(params.index / size),
                sort,
                size,
                ptype: 0,
            });
        }
        return this.client.get<GetContextTracksResult>('revision/play/v1/show', {
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
