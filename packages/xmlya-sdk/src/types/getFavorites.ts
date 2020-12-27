/**
 * {"ret":200,"msg":"成功","data":{"totalCount":2,"tracksList":[{"trackCoverPath":"//imagev2.xmcdn.com/group23/M01/15/33/wKgJNFgYYjzSNzBHAAWaMAvliP8250.jpg!op_type=3&columns=180&rows=180","trackId":18556415,"trackTitle":"《摸金天师》第001章 百辟刀","albumName":"摸金天师（紫襟演播）","albumId":4756811,"anchorName":"有声的紫襟","anchorId":1266964,"trackDuration":"19:21","trackPlayCount":47187081,"trackCreateAt":1468703759000,"trackCreateAtStr":"4年前","trackUrl":"/youshengshu/4756811/18556415","albumUrl":"/youshengshu/4756811/","anchorUrl":"/zhubo/1266964/","isVideo":false},{"trackCoverPath":"//imagev2.xmcdn.com/group82/M0B/E0/54/wKg5HF8L_USCp7mcAALmheAyBWM905.jpg!op_type=3&columns=180&rows=180","trackId":160038713,"trackTitle":"凡人修仙传 0612","albumName":"凡人修仙传（下）｜同名动漫原著，桑梓演播","albumId":14356532,"anchorName":"华音桑梓","anchorId":20115042,"trackDuration":"20:07","trackPlayCount":162894,"trackCreateAt":1550059245000,"trackCreateAtStr":"1年前","trackUrl":"/youshengshu/14356532/160038713","albumUrl":"/youshengshu/14356532/","anchorUrl":"/zhubo/20115042/","isVideo":false}],"pageNum":1,"pageSize":30,"hasMore":false}}
 */
export interface GetFavoritesResult {
    totalCount: number;
    tracksList: TracksListEntity[];
    pageNum: number;
    pageSize: number;
    hasMore: boolean;
}
export interface TracksListEntity {
    trackCoverPath: string;
    trackId: number;
    trackTitle: string;
    albumName: string;
    albumId: number;
    anchorName: string;
    anchorId: number;
    trackDuration: string;
    trackPlayCount: number;
    trackCreateAt: number;
    trackCreateAtStr: string;
    trackUrl: string;
    albumUrl: string;
    anchorUrl: string;
    isVideo: boolean;
}
