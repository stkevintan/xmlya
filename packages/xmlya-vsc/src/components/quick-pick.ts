import { IPagination } from '@xmlya/sdk';
import { leftPad } from 'src/lib';
import { ToggleOnIcon, ToggleOffIcon, PrevPageIcon, NextPageIcon } from 'src/lib/constant';
import * as vscode from 'vscode';

export interface IRenderOptions {
    items: QuickPickTreeItem[];
    pagination?: IPagination;
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static readonly Prev = new CtrlButton(PrevPageIcon, 'previous page');
    // eslint-disable-next-line @typescript-eslint/naming-convention
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

    render(title: string): void;
    render(title: string, items: QuickPickTreeItem[]): void;
    render(title: string, options: IRenderOptions): void;
    render(title: string, itemsOrOptions?: IRenderOptions | QuickPickTreeItem[]): void {
        let items: QuickPickTreeItem[] = [];
        let pagination: IPagination | undefined;
        if (!itemsOrOptions) {
            items = [];
        } else if (Array.isArray(itemsOrOptions)) {
            items = itemsOrOptions;
        } else {
            items = itemsOrOptions.items;
            pagination = itemsOrOptions.pagination;
        }
        this.renderPagination(pagination);
        this.curTreeItems = items;
        this.quickPick.busy = false;
        this.quickPick.value = '';
        this.quickPick.enabled = true;
        this.quickPick.placeholder = title;
        this.quickPick.items = this.flattenTree(items);
        this.quickPick.show();
    }

    renderPagination = (pagination?: IPagination) => {
        if (!pagination || pagination.pageSize >= pagination.totalCount) {
            this.quickPick.title = undefined;
            this.quickPick.buttons = [];
            return;
        }
        const { pageNum, pageSize, totalCount } = pagination;
        const lastPage = Math.ceil(totalCount / pageSize);
        this.quickPick.title = `Page: ${pageNum} / ${lastPage}`;
        this.quickPick.buttons = [pageNum > 1 && CtrlButton.Prev, pageNum < lastPage && CtrlButton.Next].filter(
            (x): x is CtrlButton => !!x
        );
    };

    loading(title?: string, pagination?: IPagination) {
        this.render(title || '', { items: [LoadingTreeItem], pagination });
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
        this.quickPick.dispose();
    }
}
