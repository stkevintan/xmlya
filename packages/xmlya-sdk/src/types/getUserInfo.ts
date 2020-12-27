/**
 * {"ret":200,"msg":"基本信息","data":{"uid":1266964,"nickName":"有声的紫襟","cover":"//imagev2.xmcdn.com/group52/M0B/B6/39/wKgLe1w1axDBWOWJACwzpWA7pjI535.png","background":"//imagev2.xmcdn.com/group60/M06/61/92/wKgLeVzmEWGB9Tu_AAVVgvvduSA545.jpg","isVip":true,"constellationStr":"天蝎座","constellationType":8,"personalSignature":"喜马人肉故事机！来呀，等你关注。微博求关注呀：有声的紫襟。","personalDescription":"喜马人肉故事机  有声书月度优质主播","fansCount":15340182,"gender":1,"birthMonth":10,"birthDay":27,"province":"江西省","city":"南昌市","anchorGrade":16,"anchorGradeType":2,"isMusician":false,"anchorUrl":"//www.ximalaya.com/zhubo/1266964/","relation":{"isFollow":false,"beFollow":true,"isBlack":false},"liveInfo":{"id":9520349,"roomId":132,"coverPath":"//imagev2.xmcdn.com/storages/db1b-audiofreehighqps/7F/3B/CMCoOScDgbCiAAGSEABmAAPd.jpg!op_type=3&columns=290&rows=290&magick=png","liveUrl":"http://liveroom.ximalaya.com/live/room/132?liveId=9520349","status":5},"logoType":4,"followingCount":132}}
 */

export interface GetUserInfoResult {
    uid: number;
    nickName: string;
    cover: string;
    background: string;
    isVip: boolean;
    constellationStr: string;
    constellationType: number;
    personalSignature: string;
    personalDescription: string;
    fansCount: number;
    gender: number;
    birthMonth: number;
    birthDay: number;
    province: string;
    city: string;
    anchorGrade: number;
    anchorGradeType: number;
    isMusician: boolean;
    anchorUrl: string;
    relation: Relation;
    liveInfo: LiveInfo;
    logoType: number;
    followingCount: number;
}
export interface Relation {
    isFollow: boolean;
    beFollow: boolean;
    isBlack: boolean;
}
export interface LiveInfo {
    id: number;
    roomId: number;
    coverPath: string;
    liveUrl: string;
    status: number;
}
