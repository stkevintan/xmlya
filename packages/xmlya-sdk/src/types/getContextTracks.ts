export interface GetContextTracksResult {
    uid: number;
    albumId: number;
    sort: number;
    pageNum: number;
    pageSize: number;
    tracksAudioPlay: TracksAudioPlayEntity[];
    hasMore: boolean;
    albumRecordSort: number;
}
export interface TracksAudioPlayEntity {
    index: number;
    trackId: number;
    trackName: string;
    // e.g. /youshengshu/xxx/xxx
    trackUrl: string;
    // e.g. group82/xxx/xxx/xx.jpg
    trackCoverPath: string;
    albumId: number;
    albumName: string;
    albumUrl: string;
    anchorId: number;
    duration: number;
    // e.g. 4月前
    updateTime: string;
    // e.g. 4月前
    createTime: string;
    isLike: boolean;
    isCopyright: boolean;
}
