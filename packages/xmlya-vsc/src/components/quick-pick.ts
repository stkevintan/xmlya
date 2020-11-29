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
    action?: (picker: QuickPick) => void | Promise<void>;
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
        action: (picker) => {
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

export class QuickPick extends vscode.EventEmitter<CtrlButton> {
    private readonly quickPick;

    private disposables: vscode.Disposable[] = [];
    constructor() {
        super();
        this.quickPick = vscode.window.createQuickPick<IQuickPickItem>();
        this.quickPick.canSelectMany = false;
        this.quickPick.matchOnDescription = true;
        this.quickPick.matchOnDetail = true;
        this.disposables.push(this.quickPick.onDidAccept(this.onDidAccept));
        this.disposables.push(this.quickPick.onDidTriggerButton(this.onDidTriggerButton));
    }

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

    private onDidTriggerButton = (button: vscode.QuickInputButton) => {
        if (button instanceof CtrlButton) {
            this.fire(button);
        }
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
        this.quickPick.items = this.flattenTree(this.curTreeItems);
    };

    private curTreeItems: QuickPickTreeItem[] = [];
    private eventHandler?: vscode.Disposable;

    render(title: string): void;
    render(title: string, items: QuickPickTreeItem[]): void;
    render(title: string, options: IRenderOptions): void;
    render(title: string, itemsOrOptions?: IRenderOptions | QuickPickTreeItem[]): void {
        let options: IRenderOptions;
        if (!itemsOrOptions) {
            options = { items: [] };
        } else if (Array.isArray(itemsOrOptions)) {
            options = { items: itemsOrOptions };
        } else {
            options = itemsOrOptions;
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
        this.quickPick.items = this.flattenTree(items);
        this.quickPick.show();
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
        this.eventHandler = this.event((button) => {
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
        this.render(title || '', [LoadingTreeItem]);
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

    dispose() {
        super.dispose();
        this.disposables.map((disposable) => disposable.dispose());
        this.eventHandler?.dispose();
        this.quickPick.dispose();
    }
}
