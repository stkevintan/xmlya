import { ObservableContext } from 'src/lib/context';
import { Func, Lazy } from 'src/lib';
import { Logger } from 'src/lib/logger';
import { debounce } from 'ts-debounce';
import * as vscode from 'vscode';

export interface IStatusBarItemSpec extends Omit<vscode.StatusBarItem, 'show' | 'hide' | 'priority'> {
    when?: string | Func<[ObservableContext], boolean>;
    // onChange?: ()
}

export class StatusBar extends vscode.Disposable {
    // map is ordered.
    private itemMap = new Map<string, [vscode.StatusBarItem, IStatusBarItemSpec['when']]>();

    constructor(private priorityBase: number) {
        super(() => {
            disposable?.dispose();
            this.itemMap.forEach((value) => value[0].dispose());
        });

        const disposable = this.subscribeToContext();
    }

    addItem = (key: string, spec: IStatusBarItemSpec): void => {
        Logger.assertTrue(!this.itemMap.has(key), `Duplicated key ${key} when creating status bar item`);

        const btn = vscode.window.createStatusBarItem(
            spec.alignment || vscode.StatusBarAlignment.Right,
            this.priorityBase + this.itemMap.size
        );
        this.itemMap.set(key, [btn, spec.when]);

        btn.text = spec.text;
        btn.tooltip = spec.tooltip;
        btn.color = spec.color;
        btn.command = spec.command;
        btn[this.evalWhen(spec.when) ? 'show' : 'hide']();
    };

    private evalWhen(when: IStatusBarItemSpec['when']): boolean {
        if (typeof when === 'function') {
            return when(ObservableContext);
        }

        if (typeof when === 'string') {
            return ObservableContext.testExpr(when);
        }
        return true;
    }

    private subscribeToContext(): vscode.Disposable {
        return ObservableContext.onDidContextChange(
            debounce(() => {
                for (const [item, when] of this.itemMap.values()) {
                    this.evalWhen(when) ? item.show() : item.hide();
                }
            })
        );
    }

    updateItem = (
        key: string,
        payload: Partial<
            Pick<
                IStatusBarItemSpec,
                'color' | 'alignment' | 'accessibilityInformation' | 'text' | 'tooltip' | 'command'
            >
        >
    ): void => {
        if (!this.itemMap.has(key)) {
            return;
        }
        const [btn] = this.itemMap.get(key)!;
        Object.assign(btn, payload);
    };
}
