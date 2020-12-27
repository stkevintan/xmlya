export interface GetCurrentUserResult {
    uid: number;
    realUid: number;
    nickname: string;
    logoPic: string;
    isLoginBan: boolean;
    isVerified: boolean;
    ptitle?: string;
    mobile: string;
    isRobot: boolean;
    verifyType: number;
    isVip: boolean;
    vipExpireTime: number;
    anchorGrade: number;
    userGrade: number;
    userTitle?: string;
    logoType: number;
}