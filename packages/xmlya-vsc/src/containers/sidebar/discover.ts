import { XmlyaSDK } from '@xmlya/sdk';
import { CardsEntity } from '@xmlya/sdk/dist/types/getRecomends';
import { TreeNode } from 'src/components/tree';
import { Logger } from 'src/lib';
import {
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Event,
    ProviderResult,
    EventEmitter,
    ThemeIcon,
} from 'vscode';

const logger = new Logger('sidetree-Discover');
class DiscoverEntryTreeNode extends TreeNode {
    constructor(private entry: CardsEntity) {
        super(entry.title, TreeItemCollapsibleState.Collapsed);
    }

    iconPath = new ThemeIcon('folder');

    getChildren(): ProviderResult<TreeNode[]> {
        return [
            new TreeNode('推荐')
                .setIcon(new ThemeIcon('thumbsup'))
                .setCommand('xmlya.sidebar.recommendations', `${this.entry.title} - 推荐`, this.entry.albumList),
            new TreeNode(`新品榜`)
                .setIcon(new ThemeIcon('flame'))
                .setCommand('xmlya.sidebar.soar', `${this.entry.title} - 新品榜`, this.entry.soar),
            ...this.entry.hotWord.map((word) => {
                const node = new TreeNode(word).setIcon(new ThemeIcon('tag')).setCommand('xmlya.global.search', word);
                return node;
            }),
        ];
    }
}
export class DiscoverTreeDataProvider implements TreeDataProvider<TreeNode> {
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
            const { cards } = await this.sdk.getRecommend();
            return cards.map((c) => new DiscoverEntryTreeNode(c));
        } catch (err) {
            logger.error(err.message);
            throw err;
        }
    }
}
