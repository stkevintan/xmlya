export type GetCategoriesResult = Category[];

export interface Category {
    id: number;
    name: string;
    position: number;
    groupType: number;
    displayStatus: number;
    categories: CategoriesEntity[];
}
export interface CategoriesEntity {
    id: number;
    categoryType: number;
    displayStatus: number;
    displayName: string;
    link: string;
    name: string;
    picPath: string;
    pinyin: string;
    position: number;
    subcategories: SubcategoriesEntity[];
}
export interface SubcategoriesEntity {
    id: number;
    categoryId: number;
    position: number;
    metadataId: number;
    metadataValue: string;
    code: string;
    displayStatus: number;
    link: string;
    displayValue: string;
    // metas?: any[];
    isKeyword: boolean;
}
