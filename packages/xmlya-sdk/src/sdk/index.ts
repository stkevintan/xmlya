import * as T from '../types';
import { IClient } from './client';
import { decodeNonFreeAudioSrc } from '../lib/decoder';

export class XmlyaSDK {
    constructor(private client: IClient) {}

    getRecommend = () => {
        return this.client.get<T.GetRecommendResult>('revision/explore/v2/getRecommend');
    };

    getCategories = () => {
        return this.client.get<T.GetCategoriesResult>('revision/category/allCategoryInfo');
    };

    // sort: 0 - sort by comprehensive, 2 - sort by playing count, 1 - sort by date
    getAllAlbumsInCategory = async (
        params: T.IPaginator & { sort?: 0 | 1 | 2; category: string; subcategory?: string }
    ): Promise<T.GetAllAlbumsInCategoryResult & T.IPagination> => {
        const { pageNum: page, pageSize: perPage, sort = 0, ...rest } = params;
        const ret = await this.client.get<T.GetAllAlbumsInCategoryResult>('revision/category/queryCategoryPageAlbums', {
            page,
            perPage,
            sort,
            ...rest,
        });
        return {
            totalCount: ret.total,
            pageNum: ret.page,
            ...ret,
        };
    };

    // my
    getCurrentUser = () => this.client.get<T.GetCurrentUserResult>('revision/main/getCurrentUser');

    getPlayHistory = (params?: T.IPaginator & { includeChannel?: boolean; includeRadio?: boolean }) =>
        this.client.get<T.GetPlayHistoryResult>('revision/track/history/listen', params);

    getSubscriptions = (params?: T.IPaginator & { subType?: number; category?: string }) => {
        const { pageNum: num, pageSize: size, ...rest } = params ?? {};
        return this.client.get<T.GetSubscriptionsResult>('revision/album/v1/sub/comprehensive', {
            subType: 2,
            category: 'all',
            num,
            size,
            ...rest,
        });
    };

    getFavorites = (params?: T.IPaginator) =>
        this.client.get<T.GetFavoritesResult>('revision/my/getLikeTracks', params);

    getPurchasedAlbums = (params?: T.IPaginator) =>
        this.client.get<T.GetPurchasedAlbumsResult>('revision/my/getHasBroughtAlbums', params);

    // albums
    getAlbumWithTracks = async (params: { albumId: number }) => {
        const ret = await this.client.get<T.GetAlbumWithTracksResult>('revision/album', params);
        // rename trackTotalCount to totalCount
        ret.tracksInfo.totalCount = ret.tracksInfo.trackTotalCount;
        return ret;
    };

    // user public info
    getUserPub = async (params: { uid: number }) => {
        const ret = await this.client.get<T.GetUserPubResult>('revision/user', params);
        return ret;
    };

    getUserInfo = async (params: { uid: number }) => {
        return await this.client.get<T.GetUserInfoResult>('revision/user/basic', params);
    };

    getTracksOfAlbum = async (params: T.ISortablePaginator & { albumId: number }) => {
        const ret = await this.client.get<T.GetTracksOfAlbumResult>('revision/album/v1/getTracksList', params);
        ret.totalCount = ret.trackTotalCount;
        return ret;
    };

    getTrackPageInfo = async (params: { trackId: number }) => {
        return await this.client.get<T.GetTrackPageInfoResult>('revision/track/trackPageInfo', params);
    };

    // track - youshengshu
    getCommentsOfTrack = async (
        params: T.IPaginator & { trackId: number }
    ): Promise<T.GetCommentsOfTracksResult & T.IPagination> => {
        const { pageNum: page = 1, pageSize = 20, ...rest } = params;
        const ret = await this.client.get<T.GetCommentsOfTracksResult>('revision/comment/queryComments', {
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
        this.client.get<T.GetTrackAudioResult>('revision/play/v1/audio', { id: params.trackId, ptype: 1 });

    getNonFreeTrackAudio = (params: { trackId: number }) => {
        return this.client.getRaw<void, T.GetNonFreeTrackAudioResult>(
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
            | { albumId: number; index: number; sort?: T.SortOrder; size?: number }
            | { trackId: number; sort?: T.SortOrder; size?: number }
    ) => {
        const sort = params.sort ?? T.SortOrder.asc;
        const size = params.size ?? 30;
        if ('albumId' in params) {
            return this.client.get<T.GetContextTracksResult>('revision/play/v1/show', {
                id: params.albumId,
                num: Math.ceil(params.index / size),
                sort,
                size,
                ptype: 0,
            });
        }
        return this.client.get<T.GetContextTracksResult>('revision/play/v1/show', {
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
