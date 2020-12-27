import { SortOrder } from "./utils";

  export interface GetPlayHistoryResult {
    today: HistoryEntity[];
    yesterday: HistoryEntity[];
    earlier: HistoryEntity[];
    syncPoint: number;
    pageNum: number;
    pageSize: number;
    uid: number;
    totalCount: number;
  }


  export interface HistoryEntity {
    type: number;
    itemId: number;
    itemTitle: string;
    itemCoverUrl: string;
    itemSquareCoverUrl: string;
    childId: number;
    childTitle: string;
    uid: number;
    userName: string;
    breakSecond: number;
    isPaid: boolean;
    sort: SortOrder;
    length: number;
    startedAt: number;
    startedAtFormatText: string;
    // timestamp
    endedAt: number;
    isDeleted: boolean;
    isSubscribe: boolean;
    activityTag?: null;
    vipFreeType: number;
    isVipFree: boolean;
    vipType: number;
    radioPlayCount: number;
    childStatus: number;
    childUrl: string;
    itemUrl: string;
    childIsVideo: boolean;
    childVideoCover?: null;
  }
  