import { XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { command, Runnable } from './runnable';

interface IQuickPickItem extends vscode.QuickPickItem {
    readonly tag: 'leaf' | 'parent';
    action?: (picker: QuickPicker) => void | Promise<void>;
}

function leftPad(text: string | undefined, length: number) {
    if (!text) {
        return text;
    }
    return Array.from({ length }, () => '\u2003\u2005').join('') + text;
}

class QuickPickTreeLeaf {
    readonly tag = 'leaf';
    constructor(public readonly label: string, private properties: Omit<IQuickPickItem, 'label' | 'tag'> = {}) {}

    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        ...this.properties,
        tag: this.tag,
        label: leftPad(this.label, indent)!,
        detail: leftPad(this.properties.detail, indent),
    });
}

class QuickPickTreeParent {
    expanded = true;

    readonly tag = 'parent';

    get children(): QuickPickTreeItem[] {
        return this.properties.children ?? [];
    }

    constructor(
        public readonly label: string,
        private properties: Omit<IQuickPickItem, 'label' | 'tag'> & {
            children?: QuickPickTreeItem[];
        } = {}
    ) {}

    private get toggleIcon() {
        return this.expanded ? '$(chevron-down)' : '$(chevron-right)';
    }

    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        ...this.properties,
        tag: this.tag,
        label: leftPad(`${this.toggleIcon} ${this.label}`, indent)!,
        detail: leftPad(this.properties.detail, indent),
        action: (picker) => {
            this.expanded = !this.expanded;
            picker.repaint();
        },
    });
}

type QuickPickTreeItem = QuickPickTreeParent | QuickPickTreeLeaf;

export class QuickPicker extends Runnable {
    private quickPick: vscode.QuickPick<IQuickPickItem>;
    constructor(private sdk: XmlyaSDK) {
        super(() => {
            disposable?.dispose();
            this.quickPick.dispose();
        });
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        const disposable = this.quickPick.onDidAccept(this.onDidAccept);
    }

    show(): void {
        this.quickPick.show();
    }

    hide(): void {
        this.quickPick.hide();
    }

    repaint = () => {
        this.quickPick.busy = false;
        this.quickPick.items = this.flattenTree(this.curTreeItems);
    };

    private onDidAccept = async () => {
        const item = this.quickPick.selectedItems[0];
        if (typeof item.action === 'function' && !this.quickPick.busy) {
            const thenable = item.action(this);
            if (thenable && 'then' in thenable) {
                this.quickPick.busy = true;
                await thenable;
                this.quickPick.busy = false;
            }
        }
    };

    private curTreeItems: QuickPickTreeItem[] = [];

    private render = (title: string, items: QuickPickTreeItem[]) => {
        this.curTreeItems = items;
        this.quickPick.busy = false;
        this.quickPick.value = '';
        this.quickPick.placeholder = title;
        this.quickPick.items = this.flattenTree(items);
        this.quickPick.show();
    };

    private renderLoading = () => {
        this.render('Loading...', []);
        this.quickPick.busy = true;
    };

    private flattenTree = (treeItems: QuickPickTreeItem[], deep = 0): IQuickPickItem[] => {
        const items: IQuickPickItem[] = [];
        for (const treeItem of treeItems) {
            if (treeItem.tag === 'parent') {
                const { children } = treeItem;
                items.push(treeItem.toQuickPickItem(deep));
                if (treeItem.expanded) {
                    items.push(...this.flattenTree(children, deep + 1));
                }
            } else {
                items.push(treeItem.toQuickPickItem(deep));
            }
        }
        return items;
    };

    @command('xmlya.user.playHistory')
    async renderPlayHistory() {
        this.renderLoading();
        const history = await this.sdk.getPlayHistory();

        const manifests = [
            {
                title: 'Today',
                data: history.today,
            },
            {
                title: 'Yesterday',
                data: history.yesterday,
            },
            {
                title: 'Earlier',
                data: history.earlier,
            },
        ] as const;

        this.render(
            'Play History',
            manifests.map(
                ({ title, data }) =>
                    new QuickPickTreeParent(title, {
                        description: `(${data.length})`,
                        children: data.map(
                            (entry) =>
                                new QuickPickTreeLeaf(entry.itemTitle, {
                                    description: entry.startedAtFormatText,
                                    detail: entry.childTitle,
                                    action: (picker) => {
                                        picker.hide();
                                    },
                                })
                        ),
                    })
            )
        );
    }

    @command('xmlya.user.subscriptions')
    async renderSubscriptions() {
        this.renderLoading();
        const subscriptions = await this.sdk.getSubscriptions();
        this.render(
            'Subscriptions',
            subscriptions.albumsInfo.map(
                (album) =>
                    new QuickPickTreeLeaf(album.title, {
                        detail: album.description,
                        description: album.subTitle,
                        action: (picker) => {
                            picker.hide();
                        },
                    })
            )
        );
    }

    @command('xmlya.user.home')
    async renderHome() {
        this.renderLoading();
        const user = await this.sdk.getCurrentUser();
        this.render(`Hello: ${user.nickname}!`, [
            new QuickPickTreeLeaf('Play History', { action: () => this.renderPlayHistory() }),
            new QuickPickTreeLeaf('Subscriptions', { action: () => this.renderSubscriptions() }),
        ]);
    }
}
