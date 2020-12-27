import { XmlyaSDK } from '@xmlya/sdk';
import { ContextService } from 'src/context';
import { PromiseOrNot } from 'src/lib';
import { Runnable } from 'src/runnable';
import {
    Disposable,
    EventEmitter,
    window,
    ProviderResult,
    ThemeIcon,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
} from 'vscode';

export class SideTree extends Runnable {
    initialize(context: ContextService): PromiseOrNot<Disposable | undefined> {
        window.createTreeView('xmlya-user', {
            treeDataProvider: new XmlyaTreeDataProvider(this.sdk),
        });
        return undefined;
    }
}

class XmlyaTreeNode extends TreeItem {
    contextValue = 'item';
    getChildren(): PromiseOrNot<null | XmlyaTreeNode[]> {
        return null;
    }
}

class XmlyaTreeFolderNode extends XmlyaTreeNode {
    contextValue = 'folder';
    collapsibleState = TreeItemCollapsibleState.Collapsed;

    private children: undefined | XmlyaTreeNode[];
    constructor(label: string, _children?: XmlyaTreeNode[]) {
        super(label);
        this.children = _children;
    }

    getChildren(): PromiseOrNot<XmlyaTreeNode[]> {
        return this.children ?? [];
    }
}

class HistoryFolderNode extends XmlyaTreeFolderNode {
    readonly id = 'playingHistory';

    readonly iconPath = new ThemeIcon('history');

    constructor(private sdk: XmlyaSDK) {
        super('Playing history');
    }

    async getChildren(): Promise<XmlyaTreeFolderNode[]> {
        const history = await this.sdk.getPlayHistory();
        const manifests = [
            { title: 'Today', data: history.today },
            { title: 'Yesterday', data: history.yesterday },
            { title: 'Earlier', data: history.earlier },
        ] as const;

        return manifests.map(({ title, data }) => {
            const folder = new XmlyaTreeFolderNode(
                title,
                data.map((item) => {
                    const node = new XmlyaTreeNode(item.itemTitle);
                    node.id = `${item.itemId}`;
                    return node;
                })
            );
            return folder;
        });
    }
}

export class XmlyaTreeDataProvider implements TreeDataProvider<XmlyaTreeNode> {
    private _onDidChangeTreeData = new EventEmitter<XmlyaTreeNode | undefined | void>();

    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    constructor(private sdk: XmlyaSDK) {}

    getTreeItem(element: XmlyaTreeNode): TreeItem {
        return element;
    }

    getChildren(element?: XmlyaTreeNode): ProviderResult<XmlyaTreeNode[]> {
        if (element) {
            return element.getChildren();
        }
        return [new HistoryFolderNode(this.sdk)];
    }
}
