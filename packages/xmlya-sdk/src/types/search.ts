export interface SearchResult {
    reason?: any;
    illegal: boolean;
    kw: string;
    warnWord?: any;
    album: Album;
    track: Track;
    user: User;
    live: Live;
}

export interface Album {
    docs: DocsEntity[];
    pageSize: number;
    currentPage: number;
    sc: Sc;
    total: number;
    totalPage: number;
}
export interface DocsEntity {
    playCount: number;
    coverPath: string;
    title: string;
    uid: number;
    url: string;
    categoryPinyin: string;
    categoryId: number;
    intro: string;
    albumId: number;
    isPaid: boolean;
    isFinished: number;
    categoryTitle: string;
    createdAt: number;
    isV: boolean;
    commentCount: number;
    updatedAt: number;
    isVipFree: boolean;
    nickname: string;
    customTitle?: string | null;
    verifyType: number;
    vipFreeType: number;
    displayPriceWithUnit?: string | null;
    discountedPriceWithUnit?: string | null;
    tracksCount: number;
    isNoCopyright: boolean;
    priceTypes: PriceTypesEntity[];
    anchorUrl: string;
    richTitle: string;
    vipType: number;
    albumSubscript: number;
}
export interface PriceTypesEntity {
    free_track_count: number;
    price_unit: string;
    price_type_id: number;
    price: string;
    total_track_count: number;
    id: number;
    free_track_ids: string;
    discounted_price: string;
}
export interface Sc {}
export interface Track {
    docs: DocsEntity1[];
    pageSize: number;
    currentPage: number;
    sc: Sc;
    total: number;
    totalPage: number;
}
export interface DocsEntity1 {
    createdAt: number;
    title: string;
    isV: boolean;
    duration: number;
    uid: number;
    categoryId: number;
    updatedAt: number;
    nickname: string;
    isPaid: boolean;
    id: number;
    verifyType: number;
    categoryTitle: string;
    isNoCopyright: boolean;
    albumId: number;
    albumTitle: string;
    price: string;
    discounterPrice: string;
    isFree: boolean;
    isAuthorized: boolean;
    priceTyped: number;
    playCount: number;
    commentCount: number;
    shareCount: number;
    likeCount: number;
    albumCoverPath: string;
    isTrailer: number;
    isTrailerBool: boolean;
    sampleDuration: number;
    coverPath: string;
    trackUrl: string;
    albumUrl: string;
    userUrl: string;
    richTitle: string;
    isVideo: boolean;
}
export interface User {
    docs: DocsEntity2[];
    pageSize: number;
    currentPage: number;
    sc: Sc;
    total: number;
    totalPage: number;
}
export interface DocsEntity2 {
    uid: number;
    pTitle: string | null;
    createTime: number;
    gender: string;
    isVerified: boolean;
    logoPic: string;
    lastUpdate: number;
    nickname: string;
    personDescribe: string | null;
    verifyType: number;
    tracksCount: number;
    followersCount: number;
    followingsCount: number;
    isVip: boolean;
    userGrade: number;
    anchorGrade: number;
    liveStatus: number;
    url: string;
    description: string | null;
    albumCount: number;
    isFollow: boolean;
    isBlack: boolean;
    beFollow: boolean;
    richNickName: string;
    logoType: number;
}
export interface Live {
    docs: DocsEntity3[];
    pageSize: number;
    currentPage: number;
    sc: Sc;
    total: number;
    totalPage: number;
}

export interface DocsEntity3 {
    playCount: number;
    coverPath: string;
    name: string;
    title: string;
    programName: string;
    unrichProgramName: string;
    radioId: number;
    fmUid: number;
    programScheduleId: number;
}
