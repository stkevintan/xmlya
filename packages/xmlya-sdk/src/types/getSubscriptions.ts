/*
  {"ret":200,"data":{"albumsInfo":[{"id":14356532,"title":"凡人修仙传（下）｜同名动漫原著，桑梓演播","subTitle":"山村小子如何笑傲三界","description":"《凡人修仙传》上部和下部都已加入VIP，会员戳《凡人修仙传（上）｜ 桑梓演播》免费听上部哦~【内容简介】一个普通山村小子，偶然下进入到当地江湖小门派，成了一名记名弟子。他以这样身份，如何在门派中立足,","coverPath":"group82/M0B/E0/54/wKg5HF8L_USCp7mcAALmheAyBWM905.jpg","isFinished":false,"isPaid":true,"anchor":{"anchorUrl":"/zhubo/20115042/","anchorNickName":"华音桑梓","anchorUid":20115042,"anchorCoverPath":"group78/M07/47/C0/wKgO1l5850ijpCWkAANdmo8WoI0922.jpg","logoType":4},"playCount":119704541,"trackCount":958,"albumUrl":"/youshengshu/14356532/","albumStatus":1,"lastUptrackAt":1609070402000,"lastUptrackAtStr":"3小时前","serialState":1,"isTop":false,"categoryCode":"youshengshu","categoryTitle":"有声书","lastUptrackUrl":"/youshengshu/14356532/369170148","lastUptrackTitle":"凡人修仙传 1382","vipType":2,"albumSubscript":3}],"privateSub":false,"pageNum":1,"pageSize":30,"totalCount":1,"uid":263415566,"currentUid":263415566,"categoryCode":"all","categoryArray":[{"code":"all","title":"全部","count":1},{"code":"youshengshu","title":"有声书","count":1}]}}
*/

export interface GetSubscriptionsResult {
    albumsInfo: AlbumsInfoEntity[];
    privateSub: boolean;
    pageNum: number;
    pageSize: number;
    totalCount: number;
    uid: number;
    currentUid: number;
    categoryCode: string;
    categoryArray?: CategoryArrayEntity[];
}
export interface AlbumsInfoEntity {
    id: number;
    title: string;
    subTitle: string;
    description: string;
    coverPath: string;
    isFinished: boolean;
    isPaid: boolean;
    anchor: Anchor;
    playCount: number;
    trackCount: number;
    albumUrl: string;
    albumStatus: number;
    lastUptrackAt: number;
    lastUptrackAtStr: string;
    serialState: number;
    isTop: boolean;
    categoryCode: string;
    categoryTitle: string;
    lastUptrackUrl: string;
    lastUptrackTitle: string;
    vipType: number;
    albumSubscript: number;
}
export interface Anchor {
    anchorUrl: string;
    anchorNickName: string;
    anchorUid: number;
    anchorCoverPath: string;
    logoType: number;
}
export interface CategoryArrayEntity {
    code: string;
    title: string;
    count: number;
}
