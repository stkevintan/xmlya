/**
 * {"ret":200,"msg":"成功","data":{"totalCount":0,"albumList":[],"pageNum":1,"pageSie":30}}
 */
export interface GetPurchasedAlbumsResult {
    totalCount: number;
    albumList: any[];
    pageNum: number;
    pageSie: number;
}
