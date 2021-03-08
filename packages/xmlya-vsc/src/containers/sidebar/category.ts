import { XmlyaSDK } from '@xmlya/sdk';
import { CategoriesEntity, Category } from '@xmlya/sdk/dist/types/getCategories';
import { TreeNode } from 'src/components/tree';
import { Logger } from 'src/lib';
import { EventEmitter, TreeDataProvider, Event, TreeItem, ThemeIcon, TreeItemCollapsibleState } from 'vscode';

const logger = new Logger('sidetree-Category');
export class CategoryRootTreeNode extends TreeNode {
    constructor(private c: Category) {
        super(c.name, TreeItemCollapsibleState.Collapsed);
    }

    iconPath = new ThemeIcon('folder');
    getChildren(): TreeNode[] {
        return this.c.categories.map((cc) => new CategoryEntryTreeNode(cc));
    }
}

export class CategoryEntryTreeNode extends TreeNode {
    constructor(private c: CategoriesEntity) {
        super(c.displayName, TreeItemCollapsibleState.Collapsed);
    }

    iconPath = new ThemeIcon('folder');

    getChildren(): TreeNode[] {
        return this.c.subcategories
            .sort((a, b) => {
                if (a.metadataId === 6666666 && b.metadataId === 6666666) {
                    return a.position - b.position;
                }
                if (a.metadataId !== 6666666 && b.metadataId !== 6666666) {
                    return a.position - b.position;
                }
                return a.metadataId === 6666666 ? -1 : 1;
            })
            .map((c) =>
                new TreeNode(c.displayValue)
                    .setIcon(c.metadataId === 6666666 ? new ThemeIcon('star') : new ThemeIcon('library'))
                    .setCommand(
                        'xmlya.sidebar.showAlbumsOfCategory',
                        `${this.c.displayName} - ${c.displayValue}`,
                        this.c.pinyin,
                        c.code
                    )
            );
    }
}
export class CategoryTreeDataProvider implements TreeDataProvider<TreeNode> {
    constructor(private sdk: XmlyaSDK) {}
    private _onDidChangeTreeData: EventEmitter<TreeNode | undefined | void> = new EventEmitter<
        TreeNode | undefined | void
    >();
    readonly onDidChangeTreeData: Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
        return element;
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[] | null | undefined> {
        if (element) {
            return element.getChildren();
        }
        try {
            const cateogries = await this.sdk.getCategories();
            return cateogries.map((c) => new CategoryRootTreeNode(c));
        } catch (err) {
            logger.error(err.message);
            throw err;
        }
    }
}
