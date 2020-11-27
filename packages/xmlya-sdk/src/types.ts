export enum SortOrder {
    asc,
    desc,
}

export interface IPaginator {
    // defaults to 1
    pageNum?: number;
    // defaults to 30
    pageSize?: number;
}

export interface ISortablePaginator extends IPaginator {
    sort?: SortOrder;
}

export interface IPagination {
    pageNum: number;
    pageSize: number;
    totalCount: number;
}

export interface ICurrentUser {
    isVip: boolean;
    isVerified: boolean;
    logoPic: string;
    logoType: number;
    mobile: string;
    nickname: string;
    realUid: number;
    uid: number;
    userGrade: number;
    userTitle?: string;
    vipExpireTime: number;
}

export interface IHistory {
    type: number;
    itemId: number;
    // example: group11/M07/B6/FA/wKgDbVZWzMmQ92CxAALmheAyBWM482.jpg
    itemCoverUrl: string;
    itemSquareCoverUrl: string;
    itemTitle: string;
    // example: /youshengshu/3290982/
    itemUrl: string;
    length: number;
    uid: number;
    userName: string;
    breakSecond: number;
    childId: number;
    childIsVideo: boolean;
    childStatus: number;
    childTitle: string;
    // example: /youshengshu/3290982/77796203
    childUrl: string;
    childVideoCover?: string;
    // timestamp
    endedAt: number;
    isDeleted: boolean;
    isPaid: boolean;
    isSubscribe: boolean;
    isVipFree: boolean;

    radioPlayCount: number;
    sort: SortOrder;
    startedAt: number;
    startedAtFormatText: string;
    vipFreeType: number;
    vipType: number;
}

export interface IPlayHistory extends IPagination {
    uid: number;
    yesterday: IHistory[];
    today: IHistory[];
    earlier: IHistory[];
    // sync timestamp
    syncPoint: number;
}

// maybe IAuthor ?
export interface IAnchor {
    // example: /zhubo/20115042/
    anchorUrl: string;
    anchorNickName: string;
    anchorUid: number;
    anchorCoverPath: string;
    logoType: number;
}
export interface IAlbum {
    id: number;
    title: string;
    subTitle: string;
    description: string;
    coverPath: string;
    isFinished: boolean;
    isPaid: boolean;
    // maybe author ?
    anchor: IAnchor;
    playCount: number;
    trackCount: number;
    // example: "/youshengshu/14356532/"
    albumUrl: string;
    albumStatus: number;
    lastUptrackAt: number;
    lastUptrackAtStr: string;
    // example: "/youshengshu/14356532/357880399"
    lastUptrackUrl: string;
    lastUptrackTitle: string;
    serialState: number;
    isTop: boolean;
    // example: youshengshu
    categoryCode: string;
    categoryTitle: string;
    vipType: number;
    albumSubscript: number;
}

export interface ISubscriptions extends IPagination {
    uid: number;
    albumsInfo: IAlbum[];
    categoryArray: {
        code: string;
        title: string;
        count: number;
    }[];
    // example: all, youshengshu, ...
    categoryCode: string;
}

export interface ITrack {
    // example: //imagev2.xmcdn.com/...
    trackCoverPath: string;
    trackId: number;
    trackTitle: string;
    albumName: string;
    albumId: number;
    anchorName: string;
    // example: 20:07
    trackDuration: string;
    trackPlayCount: number;
    trackCreateAt: number;
    trackCreateAtStr: string;
    // example: /youshengshu/xxx/xxx
    trackUrl: string;
    // example: /youshengshu/xxx
    albumUrl: string;
    // example: /zhubo/xxx
    anchorUrl: string;
    isVideo: boolean;
}

export interface IFavorites extends IPagination {
    tracksList: ITrack[];
}

export interface IPurchasedAlbums extends IPagination {
    albumList: IAlbum[];
}

export interface IAnchorInfoDetail {
    anchorAlbumList: { albumId: number; albumTitle: string };
    anchorAlbumsCount: number;
    anchorCover: string;
    anchorFansCount: number;
    anchorFollowsCount: number;
    anchorGrade: number;
    anchorGradeType: number;
    anchorId: number;
    anchorName: string;
    anchorTracksCount: number;
    logoType: number;
    personalIntroduction: string;
}

export interface IAlbumMainInfo {
    albumStatus: number;
    albumSubscript: number;
    albumTitle: string;
    bigshotRecommend: string;
    canCopyText: boolean;
    cover: string;
    // e.g.: 2018-03-21
    createDate: string;
    customTitle: string;
    isFinished: boolean;
    isPaid: boolean;
    isPublic: boolean;
    isSubscribe: boolean;
    playCount: number;
    shortIntro: string;
    tags: string[];
    recommendReason: string;
    // html content
    richIntro: string;
    //e.g.: 2020-11-20
    updateDate: string;
    vipType: number;
}

export interface ITrackInAlbum {
    index: number;
    trackId: number;
    isPaid: boolean;
    title: string;
    playCount: number;
    isLike: boolean;
    // 2年前
    createDateFormat: string;
    url: string;
    duration: number;
    isVideo: boolean;
    videoCover?: string;
    isVipFirst: boolean;
    breakSecond: number;
    length: number;
}

export interface IAlbumDetail {
    albumId: number;
    anchorInfo: IAnchorInfoDetail;
    currentUid: number;
    isSelfAlbum: boolean;
    isTemporaryVIP: boolean;
    mainInfo: IAlbumMainInfo;
    tracksInfo: {
        lastPlayTrackId: number;
        sort: SortOrder;
        tracks: ITrackInAlbum[];
    } & IPagination;
}

export interface ITracksInAlbum extends IPagination {
    currentUid: number;
    albumId: number;
    sort: SortOrder;
    tracks: ITrackInAlbum[];
}

interface ICommentBase {
    id: number;
    content: string;
    uid: number;
    nickname: string;
    // e.g.: //imagev2.xmcdn.com/xxx
    smallHeader: string;
    //e.g.: 10小时前
    createAt: string;
    likes: number;
    liked: boolean;
    logoType: number;
}

export interface ICommentInReply extends ICommentBase {
    ancestorId: number;
    parentId: number;
    parentUid: number;
    parentNickname: string;
}

export interface ICommentInTrack extends ICommentBase {
    // timestamp
    commentTime: number;
    replyCount: number;
    replies?: ICommentInReply[];
    //e.g.: /youshengshu/xxx
    link: string;
    anchorGrade: number;
    anchorGradeType: number;
}

export interface ICommentsInTrack extends IPagination {
    totalPage: number;
    comments: ICommentInTrack[];
}

export interface IContextTracks extends IPagination {
    uid: number;
    albumId: number;
    sort: SortOrder;
    tracksAudioPlay: {
        index: number;
        trackId: number;
        trackName: string;
        // e.g. /youshengshu/xxx/xxx
        trackUrl: string;
        // e.g. group82/xxx/xxx/xx.jpg
        trackCoverPath: string;
        albumId: number;
        albumName: string;
        //e.g. /youshengshu/xxx
        albumUrl: string;
        anchorId: number;
        duration: number;
        //e.g. 4月前
        updateTime: string;
        // e.g. 2年前
        createTime: string;
        isLike: boolean;
        isCopyright: boolean;
    }[];
    hasMore: boolean;
    albumRecordSort: SortOrder;
}

export interface ITrackAudio {
    trackId: number;
    canPlay: boolean;
    isPaid: boolean;
    src?: string;
    albumIsSample: boolean;
    sampleDuration: number;
    isBaiduMusic: boolean;
    firstPlayStatus: boolean;
    isVipFree: boolean;
    isXimiAhead: boolean;
    isAlbumTimeLimited: boolean;
}

export interface INonFreeTrackAudio {
    trackId: number;
    uid: number;
    albumId: number;
    title: string;
    domain: string;
    totalLength: number;
    sampleDuration: number;
    sampleLength: number;
    isAuthorized: boolean;
    apiVersion: string;
    seed: number;
    fileId: string;
    buyKey: number;
    duration: number;
    ep: string;
    src?: string;
    highestQualityLevel: number;
    downloadQualityLevel: number;
    authorizedType: number;
}

export interface IFileParams {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    buy_key: string;
    sign: string;
    token: string;
    timestamp: string;
}
