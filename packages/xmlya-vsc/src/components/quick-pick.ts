import { IPagination, SortOrder } from '@xmlya/sdk';
import { Callback, leftPad } from 'src/lib';
import { ToggleOnIcon, ToggleOffIcon, PrevPageIcon, NextPageIcon } from 'src/lib/constant';
import * as vscode from 'vscode';

export interface IRenderOptions {
    items: QuickPickTreeItem[];
    pagination?: IPagination;
    sort?: SortOrder;
    value?: string;
    onPageChange?: (pageNum: number, sort?: SortOrder) => void;
    onSortChange?: (sort: SortOrder) => void;
}

export interface IQuickPickItem extends vscode.QuickPickItem {
    tag: TreeItemTag;
    onClick?: (picker: QuickPick) => void | Promise<void>;
    type?: string;
    active?: boolean;
}

type TreeItemTag = 'leaf' | 'parent' | 'action';

export class QuickPickTreeLeaf {
    constructor(readonly label: string, readonly properties: Omit<IQuickPickItem, 'label' | 'tag'> = {}) {}
    readonly tag: TreeItemTag = 'leaf';
    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        ...this.properties,
        tag: this.tag,
        label: leftPad(this.label, indent)!,
        detail: leftPad(this.properties.detail, indent),
    });
}

const LoadingTreeItem = new QuickPickTreeLeaf('$(loading~spin)', { description: 'Loading...' });

export class QuickPickTreeParent {
    expanded = true;

    get children(): QuickPickTreeItem[] {
        return this.properties.children ?? [];
    }

    constructor(
        readonly label: string,
        readonly properties: Omit<IQuickPickItem, 'label' | 'tag'> & {
            children?: QuickPickTreeItem[];
        } = {}
    ) {}

    private get toggleIcon() {
        return this.expanded ? ToggleOnIcon : ToggleOffIcon;
    }

    readonly tag: TreeItemTag = 'parent';

    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        tag: this.tag,
        ...this.properties,
        alwaysShow: true,
        label: leftPad(`$(${this.toggleIcon}) ${this.label}`, indent)!,
        detail: leftPad(this.properties.detail, indent),
        onClick: (picker) => {
            picker.toggleFolder(this);
        },
    });
}

export class QuickPickTreeAction extends QuickPickTreeLeaf {
    readonly tag: TreeItemTag = 'action';
}

export type QuickPickTreeItem = QuickPickTreeParent | QuickPickTreeLeaf | QuickPickTreeAction;

export class CtrlButton implements vscode.QuickInputButton {
    static readonly Asc = new CtrlButton('triangle-up', 'asc order');
    static readonly Desc = new CtrlButton('triangle-down', 'desc order');
    static readonly Prev = new CtrlButton(PrevPageIcon, 'previous page');
    static readonly Next = new CtrlButton(NextPageIcon, 'next page');

    readonly tooltip?: string;

    iconPath: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon;

    constructor(icon: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri }, tooltip?: string) {
        this.iconPath = typeof icon === 'string' ? new vscode.ThemeIcon(icon) : icon;
        this.tooltip = tooltip;
    }
}

type HistoryAction = 'replace' | 'push' | 'ignore';

export class QuickPick extends vscode.Disposable {
    private readonly quickPick;
    private disposables: vscode.Disposable[] = [];
    constructor({ disposeOnHide, ignoreFocusOut }: { disposeOnHide?: boolean; ignoreFocusOut?: boolean } = {}) {
        super(() => {
            this.eventHandler?.dispose();
            vscode.Disposable.from(...this.disposables, this.quickPick).dispose();
        });
        this.quickPick = vscode.window.createQuickPick<IQuickPickItem>();
        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        if (ignoreFocusOut) {
            this.quickPick.ignoreFocusOut = true;
        }
        if (disposeOnHide) {
            this.disposables.push(this.quickPick.onDidHide(() => this.dispose()));
        }
        this.disposables.push(this.quickPick.onDidHide(() => (this.historyStack = [])));
        this.disposables.push(this.quickPick.onDidAccept(this.onDidAccept));
    }

    private onDidAccept = async () => {
        const item = this.quickPick.selectedItems[0];
        if (item && typeof item.onClick === 'function' && !this.quickPick.busy) {
            const thenable = item.onClick(this);
            if (thenable && 'then' in thenable) {
                this.quickPick.busy = true;
                await thenable;
                this.quickPick.busy = false;
            }
        }
    };

    private onDidTriggerButton = (cb: Callback<CtrlButton>) => {
        return this.quickPick.onDidTriggerButton((button) => {
            if (button instanceof CtrlButton) {
                cb(button);
            }
        });
    };

    setBusy(busy: boolean = true): void {
        this.quickPick.busy = !!busy;
    }

    show(): void {
        this.quickPick.show();
    }

    hide(): void {
        this.quickPick.hide();
    }

    get value(): string {
        return this.quickPick.value;
    }

    toggleFolder = (folder: QuickPickTreeParent) => {
        folder.expanded = !folder.expanded;
        const items = this.curTreeItems.map((item) => {
            item.properties.active = folder === item;
            return item;
        });
        this.repaint(items);
    };

    repaint = (items?: QuickPickTreeItem[]) => {
        if (items) {
            this.curTreeItems = items;
        }
        this.quickPick.busy = false;
        this.quickPick.items = this.quickPick.items
            .filter((item) => item.tag === 'action')
            .concat(this.flattenTree(this.curTreeItems));
        this.setActiveItems();
    };

    private curTreeItems: QuickPickTreeItem[] = [];
    private eventHandler?: vscode.Disposable;

    private historyStack: [string, IRenderOptions][] = [];

    render(title: string, action?: HistoryAction): void;
    render(title: string, items: QuickPickTreeItem[], action?: HistoryAction): void;
    render(title: string, options: IRenderOptions, action?: HistoryAction): void;
    render(
        title: string,
        param?: HistoryAction | IRenderOptions | QuickPickTreeItem[],
        action: HistoryAction | null = 'push'
    ): void {
        let options: IRenderOptions;
        if (!param) {
            options = { items: [] };
        } else if (typeof param === 'string') {
            options = { items: [] };
            action = param;
        } else if (Array.isArray(param)) {
            options = { items: param };
        } else {
            options = { ...param };
        }

        if (action === 'push') {
            this.historyStack.push([title, options]);
        } else if (action === 'replace') {
            if (this.historyStack.length > 0) {
                this.historyStack.pop();
            }
            this.historyStack.push([title, options]);
        }

        const { items, pagination, sort, onPageChange, onSortChange, value = '' } = options;

        if (pagination) {
            this.renderPagination({ pagination, sort, onPageChange, onSortChange });
        } else {
            this.removePagination();
        }

        this.curTreeItems = items;
        this.quickPick.busy = false;
        this.quickPick.value = value;
        this.quickPick.enabled = true;
        this.quickPick.placeholder = title;
        const actions = action === 'ignore' ? [] : this.createActions();
        this.quickPick.items = this.flattenTree([...actions, ...items]);
        this.setActiveItems();
        this.disposables.push(this.quickPick.onDidChangeValue((w) => (options.value = w)));
        this.quickPick.show();
    }

    private setActiveItems() {
        const activeItems = this.quickPick.items.filter((item) => item.active);
        if (activeItems.length) {
            this.quickPick.activeItems = activeItems;
        }
    }
    private createActions(): QuickPickTreeItem[] {
        // history stack should always have one item (the current one);
        if (this.historyStack.length === 1) return [];

        return [
            new QuickPickTreeAction('$(arrow-small-left)', {
                description: 'Go back',
                alwaysShow: true,
                onClick: () => {
                    if (this.quickPick.busy) return;
                    this.historyStack.pop()!;
                    const [title, options] = this.historyStack[this.historyStack.length - 1];
                    this.render(title, options, null as any);
                },
            }),
        ];
    }

    onDidHide = (cb: Callback<void>) => this.quickPick.onDidHide(cb);
    onDidChangeValue = (cb: Callback<string>) => this.quickPick.onDidChangeValue(cb);

    private renderPagination = (options: {
        pagination: IPagination;
        sort?: SortOrder;
        onPageChange?: IRenderOptions['onPageChange'];
        onSortChange?: IRenderOptions['onSortChange'];
    }) => {
        const { onPageChange, onSortChange, sort, pagination } = options;
        const { pageNum, pageSize, totalCount } = pagination;
        if (pageSize >= totalCount) return this.removePagination();
        const lastPage = Math.ceil(totalCount / pageSize);
        this.quickPick.title = `Page: ${pageNum} / ${lastPage}`;
        this.quickPick.buttons = [
            sort === SortOrder.asc && CtrlButton.Asc,
            sort === SortOrder.desc && CtrlButton.Desc,
            pageNum > 1 && CtrlButton.Prev,
            pageNum < lastPage && CtrlButton.Next,
        ].filter((x): x is CtrlButton => !!x);

        this.eventHandler?.dispose();
        this.eventHandler = this.onDidTriggerButton((button) => {
            switch (button) {
                case CtrlButton.Prev:
                    return onPageChange?.(pageNum - 1);
                case CtrlButton.Next:
                    return onPageChange?.(pageNum + 1);
                case CtrlButton.Asc:
                    return onSortChange?.(SortOrder.desc);
                case CtrlButton.Desc:
                    return onSortChange?.(SortOrder.asc);
            }
        });
    };

    private removePagination = () => {
        this.quickPick.title = undefined;
        this.quickPick.buttons = [];
        this.eventHandler?.dispose();
        this.eventHandler = undefined;
        return;
    };

    loading(title?: string) {
        this.render(title || '', [LoadingTreeItem], 'ignore');
        this.quickPick.enabled = false;
        this.quickPick.busy = true;
    }

    private flattenTree = (treeItems: QuickPickTreeItem[], deep = 0): IQuickPickItem[] => {
        const items: IQuickPickItem[] = [];
        for (const treeItem of treeItems) {
            if (treeItem instanceof QuickPickTreeParent) {
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
}
