import {
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    Event,
    ProviderResult,
    EventEmitter,
    ThemeIcon,
} from 'vscode';

export class UserTreeNode extends TreeItem {
    constructor(public readonly label: string, private iconName: string, private commandName: string) {
        super(label, TreeItemCollapsibleState.None);
    }

    iconPath = new ThemeIcon(this.iconName);

    command = { command: this.commandName, title: this.label };

    getChildren(): ProviderResult<UserTreeNode[]> {
        return null;
    }
}

export class UserTreeDataProvider implements TreeDataProvider<UserTreeNode> {
    private _onDidChangeTreeData: EventEmitter<UserTreeNode | undefined | void> = new EventEmitter<
        UserTreeNode | undefined | void
    >();
    readonly onDidChangeTreeData: Event<UserTreeNode | undefined | void> = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: UserTreeNode): TreeItem | Thenable<TreeItem> {
        return element;
    }

    getChildren(element?: UserTreeNode): ProviderResult<UserTreeNode[]> {
        if (element == null) {
            return [
                new UserTreeNode('历史', 'history', 'xmlya.user.playHistory'),
                new UserTreeNode('订阅', 'star-empty', 'xmlya.user.subscriptions'),
                new UserTreeNode('喜欢', 'heart', 'xmlya.user.favorites'),
                new UserTreeNode('已购', 'gift', 'xmlya.user.purchasedAlbums'),
            ];
        }
        return element.getChildren();
    }
}
