export interface GetAllAlbumsInCategoryResult {
    page: number;
    total: number;
    pageSize: number;
    albums: AlbumsEntity[];
    pageConfig: PageConfig;
}
export interface AlbumsEntity {
    albumId: number;
    title: string;
    coverPath: string;
    anchorName: string;
    uid: number;
    isPaid: boolean;
    isFinished: number;
    link: string;
    playCount: number;
    trackCount: number;
    vipType: number;
    albumSubscript: number;
}
export interface PageConfig {}
