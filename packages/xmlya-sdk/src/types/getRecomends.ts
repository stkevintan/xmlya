export interface GetRecommendResult {
    cards: CardsEntity[];
}

export interface CardsEntity {
    categoryId: number;
    title: string;
    name: string;
    albumList: AlbumListEntity[];
    moreUrl: string;
    hotWord: string[];
    soar: SoarEntity[];
}

export interface AlbumListEntity {
    albumId: number;
    albumPlayCount: number;
    albumTrackCount: number;
    albumCoverPath: string;
    albumTitle: string;
    albumUserNickName: string;
    anchorId: number;
    anchorGrade: number;
    isDeleted: boolean;
    isPaid: boolean;
    isFinished: number;
    anchorUrl: string;
    albumUrl: string;
    intro: string;
    vipType: number;
    logoType: number;
    albumSubscript: number;
}

export interface SoarEntity {
    id: number;
    albumTitle: string;
    albumUrl: string;
    cover: string;
    anchorUrl: string;
    playCount: number;
    trackCount: number;
    description: string;
    tagStr: string;
    isPaid: boolean;
    price: string;
    isSubscribe: boolean;
    categoryId: number;
    categoryCode: string;
    categoryTitle: string;
    lastUpdateTrack: string;
    lastUpdateTrackUri: string;
    vipType: number;
    anchorName: string;
    lastUptrackAtStr: string;
    rankingScore?: null;
    rankingPositionChange: number;
    albumSubscript: number;
}
