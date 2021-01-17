import { XmlyaSDK } from '@xmlya/sdk';
import { Category } from '@xmlya/sdk/dist/types/getCategories';
import { TreeNode } from 'src/components/tree';
import { EventEmitter, TreeDataProvider, Event, TreeItem, ThemeIcon, TreeItemCollapsibleState } from 'vscode';

export class CategoryEntryTreeNode extends TreeNode {
    constructor(private c: Category) {
        super(c.name, TreeItemCollapsibleState.Collapsed);
    }

    iconPath = new ThemeIcon('folder');
    getChildren(): TreeNode[] {
        return this.c.categories.map((cc) => new TreeNode(cc.displayName));
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
        const cateogries = await this.sdk.getCategories();
        return cateogries.map((c) => new CategoryEntryTreeNode(c));
    }
}
