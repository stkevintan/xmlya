import { IPagination, SortOrder } from '@xmlya/sdk';
import { Callback, leftPad } from 'src/lib';
import { ToggleOnIcon, ToggleOffIcon, PrevPageIcon, NextPageIcon, AscOrderIcon, DescOrderIcon } from 'src/lib/constant';
import * as vscode from 'vscode';

export interface IRenderOptions {
    items: QuickPickTreeItem[];
    pagination?: IPagination;
    sort?: SortOrder;
    onPageChange?: (pageNum: number, sort?: SortOrder) => void;
    onSortChange?: (sort: SortOrder) => void;
}

export interface IQuickPickItem extends vscode.QuickPickItem {
    readonly tag: 'leaf' | 'parent';
    onClick?: (picker: QuickPick) => void | Promise<void>;
}

export class QuickPickTreeLeaf {
    readonly tag = 'leaf';
    constructor(public readonly label: string, private properties: Omit<IQuickPickItem, 'label' | 'tag'> = {}) {}

    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        ...this.properties,
        tag: this.tag,
        label: leftPad(this.label, indent)!,
        detail: leftPad(this.properties.detail, indent),
    });
}

const LoadingTreeItem = new QuickPickTreeLeaf('Loading...');

export class QuickPickTreeParent {
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
        return this.expanded ? ToggleOnIcon : ToggleOffIcon;
    }

    toQuickPickItem = (indent = 0): IQuickPickItem => ({
        ...this.properties,
        tag: this.tag,
        label: leftPad(`$(${this.toggleIcon}) ${this.label}`, indent)!,
        detail: leftPad(this.properties.detail, indent),
        onClick: (picker) => {
            this.expanded = !this.expanded;
            picker.repaint();
        },
    });
}

type QuickPickTreeItem = QuickPickTreeParent | QuickPickTreeLeaf;

export class CtrlButton implements vscode.QuickInputButton {
    static readonly Asc = new CtrlButton(AscOrderIcon, 'asc order');
    static readonly Desc = new CtrlButton(DescOrderIcon, 'desc order');
    static readonly Prev = new CtrlButton(PrevPageIcon, 'previous page');
    static readonly Next = new CtrlButton(NextPageIcon, 'next page');

    readonly iconPath: vscode.ThemeIcon;
    readonly tooltip?: string;

    constructor(icon: string, tooltip?: string) {
        this.iconPath = new vscode.ThemeIcon(icon);
        this.tooltip = tooltip;
    }
}

type HistoryAction = 'replace' | 'push' | 'ignore';

export class QuickPick extends vscode.Disposable {
    private readonly quickPick;
    private disposables: vscode.Disposable[] = [];
    constructor() {
        super(() => {
            this.eventHandler?.dispose();
            vscode.Disposable.from(...this.disposables, this.quickPick).dispose();
        });
        this.quickPick = vscode.window.createQuickPick<IQuickPickItem>();
        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        this.disposables.push(this.quickPick.onDidHide(() => (this.historyStack = [])));
        this.disposables.push(this.quickPick.onDidAccept(this.onDidAccept));
    }

    private onDidAccept = async () => {
        const item = this.quickPick.selectedItems[0];
        if (typeof item.onClick === 'function' && !this.quickPick.busy) {
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

    repaint = () => {
        this.quickPick.busy = false;
        this.quickPick.items = this.quickPick.items
            .filter((item) => item.alwaysShow)
            .concat(this.flattenTree(this.curTreeItems));
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
            options = param;
        }

        if (action === 'push') {
            this.historyStack.push([title, options]);
        } else if (action === 'replace') {
            if (this.historyStack.length > 0) {
                this.historyStack.pop();
            }
            this.historyStack.push([title, options]);
        }

        const { items, pagination, sort, onPageChange, onSortChange } = options;

        if (pagination) {
            this.renderPagination({ pagination, sort, onPageChange, onSortChange });
        } else {
            this.removePagination();
        }

        this.curTreeItems = items;
        this.quickPick.busy = false;
        this.quickPick.value = '';
        this.quickPick.enabled = true;
        this.quickPick.placeholder = title;
        const actions = action === 'ignore' ? [] : this.createActions();
        this.quickPick.items = this.flattenTree([...actions, ...items]);
        this.quickPick.show();
    }

    private createActions(): QuickPickTreeItem[] {
        // history stack should always have one item (the current one);
        if (this.historyStack.length === 1) return [];

        return [
            new QuickPickTreeLeaf('$(arrow-small-left)', {
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

    dispose() {}
}
