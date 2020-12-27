import { SortOrder } from "./utils";

export interface GetTrackPageInfoResult {
    trackInfo: TrackInfo;
    albumInfo: AlbumInfo;
    userInfo: UserInfo;
    moreTracks?: null[] | null;
    metas?: MetasEntity[] | null;
    category: Category;
    subSiteTrackUrl: string;
    hasBuy: boolean;
    isTemporaryVIP: boolean;
    vipPermission: boolean;
}

export interface TrackInfo {
    trackId: number;
    title: string;
    coverPath: string;
    richIntro: string;
    shortIntro: string;
    lastUpdate: string;
    playCount: number;
    isLike: boolean;
    isPaid: boolean;
    isOwn: boolean;
    paidSoundType: number;
    priceType: number;
    isAuthorized: boolean;
    price?: null;
    discountedPrice?: null;
    approveStatus: number;
    link: string;
    draft?: null;
    waves?: null;
    duration: number;
    position: Position;
    vipType: number;
    canCopyText: boolean;
    isVideo: boolean;
    videoCover?: null;
    videoPermission: boolean;
    isVipFree: boolean;
    userPermission: string;
    likeCount: number;
    commentCount: number;
    vipFirst: boolean;
}
export interface Position {
    pageNum: number;
    pageSize: number;
    sort: SortOrder;
}
export interface AlbumInfo {
    albumId: number;
    title: string;
    coverPath: string;
    playCount: number;
    link: string;
    trackCount: number;
    description: string;
    isSubscribe: boolean;
    subscribeCount: number;
    vipFreeType: number;
    isPaid: boolean;
    hasBuy: boolean;
}
export interface UserInfo {
    uid: number;
    nickname: string;
    trackCount: number;
    albumCount: number;
    followCount: number;
    fansCount: number;
    intro?: null;
    coverPath: string;
    isViper: number;
    vipLevel: number;
    isFollowingBy: boolean;
    link: string;
    logoType: number;
}
export interface MetasEntity {
    metaValueId: number;
    metaDataId: number;
    categoryId: number;
    isSubCategory: boolean;
    categoryName: string;
    categoryPinyin: string;
    metaValueCode: string;
    metaDisplayName: string;
    link: string;
}
export interface Category {
    categoryId: number;
    categoryName: string;
    categoryTitle: string;
    categoryPinyin: string;
    subcategoryId: number;
    subcategoryName: string;
    subcategoryDisplayName: string;
    subcategoryMetaId: number;
    subcategoryCode: string;
}
