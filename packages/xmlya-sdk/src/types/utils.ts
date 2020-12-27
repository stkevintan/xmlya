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

