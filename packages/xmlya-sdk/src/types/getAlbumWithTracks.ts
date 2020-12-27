export interface GetAlbumWithTracksResult {
    isSelfAlbum: boolean;
    currentUid: number;
    albumId: number;
    mainInfo: MainInfo;
    anchorInfo: AnchorInfo;
    tracksInfo: TracksInfo;
    subSiteAlbumUrl: string;
    recommendKw: RecommendKw;
    draft: string;
    isTemporaryVIP: boolean;
}
export interface MainInfo {
    albumStatus: number;
    showApplyFinishBtn: boolean;
    showEditBtn: boolean;
    showTrackManagerBtn: boolean;
    showInformBtn: boolean;
    cover: string;
    albumTitle: string;
    crumbs: Crumbs;
    //e.g.: 2020-11-20
    updateDate: string;
    createDate: string;
    playCount: number;
    isPaid: boolean;
    isFinished: number;
    metas: MetasEntity[];
    isSubscribe: boolean;
    // html content
    richIntro: string;
    shortIntro: string;
    detailRichIntro: string;
    isPublic: boolean;
    hasBuy: boolean;
    vipType: number;
    canCopyText: boolean;
    subscribeCount: number;
    sellingPoint: SellingPoint;
    personalDescription: string;
    bigshotRecommend: string;
    outline: string;
    customTitle: string;
    produceTeam: string;
    recommendReason: string;
    albumSubscript: number;
    tags: string[];
}
export interface Crumbs {
    categoryId: number;
    categoryPinyin: string;
    categoryTitle: string;
    subcategoryId: number;
    subcategoryName: string;
    subcategoryDisplayName: string;
    subcategoryCode: string;
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
export interface SellingPoint {}
export interface AnchorInfo {
    anchorId: number;
    anchorCover: string;
    showFollowBtn: boolean;
    anchorName: string;
    anchorGrade: number;
    anchorGradeType: number;
    anchorAlbumsCount: number;
    anchorTracksCount: number;
    anchorFollowsCount: number;
    anchorFansCount: number;
    personalIntroduction: string;
    showAnchorAlbumModel: boolean;
    anchorAlbumList: AnchorAlbumListEntity[];
    hasMoreBtn: boolean;
    logoType: number;
}
export interface AnchorAlbumListEntity {
    albumId: number;
    albumTitle: string;
    cover: string;
    playCount: number;
    tracksCount: number;
    anchorId: number;
    anchorName: string;
    url: string;
}
export interface TracksInfo {
    trackTotalCount: number;
    // will polyfill this field.
    totalCount: number;
    sort: number;
    tracks: TracksEntity[];
    pageNum: number;
    pageSize: number;
    lastPlayTrackId: number;
}
export interface TracksEntity {
    index: number;
    trackId: number;
    isPaid: boolean;
    tag: number;
    title: string;
    playCount: number;
    showLikeBtn: boolean;
    isLike: boolean;
    showShareBtn: boolean;
    showCommentBtn: boolean;
    showForwardBtn: boolean;
    createDateFormat: string;
    url: string;
    duration: number;
    isVideo: boolean;
    videoCover?: null;
    isVipFirst: boolean;
    breakSecond: number;
    length: number;
}
export interface RecommendKw {
    sourceKw: string;
    recommendText: null[];
}
