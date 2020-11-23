import { XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';

interface IQuickPickItem extends vscode.QuickPickItem {
    action?: () => void | Promise<void>;
}

function getIndent(length: number) {
    return Array.from({ length }, () => '\u2003\u2005').join('');
}

class InteractableItem implements IQuickPickItem {
    detail?: string;
    picked?: boolean;
    alwaysShow?: boolean;
    readonly tag = 'item';
    constructor(public label: string, public description: string, public action?: () => void | Promise<void>) {}
    toQuickPickItem = (deep = 0): IQuickPickItem => ({
        label: `${getIndent(deep)}${this.label}`,
        description: this.description,
        detail: this.detail,
        alwaysShow: this.alwaysShow,
        picked: this.picked,
        action: this.action,
    });
}

class InteractableParent implements IQuickPickItem {
    detail?: string;
    picked?: boolean;
    alwaysShow?: boolean;
    expanded = true;
    readonly tag = 'parent';
    constructor(public label: string, public description: string, public children: InteractableTreeItem[] = []) {}
    toQuickPickItem = (deep = 0, onAction?: () => void): IQuickPickItem => ({
        label: `${getIndent(deep)}${this.expanded ? '$(chevron-down)' : '$(chevron-right)'} ${this.label}`,
        description: this.description,
        detail: this.detail,
        alwaysShow: this.alwaysShow,
        picked: this.picked,
        action: () => {
            this.expanded = !this.expanded;
            onAction?.();
        },
    });
}

type InteractableTreeItem = InteractableItem | InteractableParent;

export class Interactor extends vscode.Disposable {
    private quickPick: vscode.QuickPick<IQuickPickItem>;
    private disposeHandler;
    constructor(private sdk: XmlyaSDK) {
        super(() => this.disposeHandler?.dispose());
        this.quickPick = vscode.window.createQuickPick();
        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        this.disposeHandler = this.quickPick.onDidAccept(this.onDidAccept);
    }

    private onDidAccept = () => {
        const item = this.quickPick.selectedItems[0];
        if (typeof item.action === 'function' && !this.quickPick.busy) {
            this.quickPick.busy = true;
            item.action();
        }
    };

    private renderList = (title: string, items: IQuickPickItem[]) => {
        this.quickPick.busy = false;
        this.quickPick.value = '';
        this.quickPick.items = items.filter((item) => item);
        this.quickPick.placeholder = title;
        this.quickPick.show();
    };

    private renderTree = (title: string, treeItems: InteractableTreeItem[]) => {
        const reVisit = (treeItems: InteractableTreeItem[], deep = 0): IQuickPickItem[] => {
            const items: IQuickPickItem[] = [];
            for (const treeItem of treeItems) {
                if (treeItem.tag === 'parent') {
                    const { children } = treeItem;
                    items.push(treeItem.toQuickPickItem(deep, () => this.renderTree(title, treeItems)));
                    if (treeItem.expanded) {
                        items.push(...reVisit(children, deep + 1));
                    }
                } else {
                    items.push(treeItem.toQuickPickItem(deep));
                }
            }
            return items;
        };
        this.renderList(title, reVisit(treeItems));
    };

    async renderPlayHistories() {
        const histories = await this.sdk.getListenHistories();
        this.renderTree('Play History', [
            new InteractableParent(
                'History: Today',
                `(${histories.today.length})`,
                histories.today.map(
                    (entry) =>
                        new InteractableItem(entry.itemTitle, entry.childTitle, () => {
                            console.log(entry);
                        })
                )
            ),
            new InteractableParent(
                'History: Yesterday',
                `(${histories.yesterday.length})`,
                histories.yesterday.map(
                    (entry) =>
                        new InteractableItem(entry.itemTitle, entry.childTitle, () => {
                            console.log(entry);
                        })
                )
            ),
            new InteractableParent(
                'History: Ealier',
                `(${histories.earlier.length})`,
                histories.earlier.map(
                    (entry) =>
                        new InteractableItem(entry.itemTitle, entry.childTitle, () => {
                            console.log(entry);
                        })
                )
            ),
        ]);
    }

    register(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('xmlya.user.home', async () => {
                const user = await this.sdk.getCurrentUser();
                this.renderList(`User: ${user.nickname}`, [
                    {
                        label: 'play history',
                        action: () => this.renderPlayHistories(),
                    },
                ]);
            })
        );
    }
}
