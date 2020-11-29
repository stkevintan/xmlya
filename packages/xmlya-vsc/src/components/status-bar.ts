import { Func, RuntimeContext } from 'src/lib';
import { Logger } from 'src/lib/logger';
import * as vscode from 'vscode';

export type When = string | Func<[RuntimeContext], boolean>;
export interface IStatusBarItemSpec {
    key: string;
    alignment?: vscode.StatusBarAlignment;
    text: string;
    tooltip?: string;
    color?: string | vscode.ThemeColor;
    command?: string | vscode.Command | undefined;
    accessibilityInformation?: vscode.AccessibilityInformation;
    when?: When;
}

export class StatusBar extends vscode.Disposable {
    // map is ordered.
    private itemMap = new Map<string, vscode.StatusBarItem>();
    private specMap = new WeakMap<vscode.StatusBarItem, IStatusBarItemSpec>();

    constructor(private ctx: RuntimeContext, private priorityBase: number) {
        super(() => {
            disposable?.dispose();
            vscode.Disposable.from(disposable, ...this.itemMap.values());
        });

        const disposable = this.subscribeToContext();
    }

    addItem = (key: string, spec: IStatusBarItemSpec): void => {
        Logger.assertTrue(!this.itemMap.has(key), `Duplicated key ${key} when creating status bar item`);

        const btn = vscode.window.createStatusBarItem(
            spec.alignment || vscode.StatusBarAlignment.Right,
            this.priorityBase + this.itemMap.size
        );
        btn.text = this.parseTemplate(spec.text);
        btn.tooltip = spec.tooltip;
        btn.color = spec.color;
        btn.command = spec.command;
        btn[this.evalWhen(spec.when) ? 'show' : 'hide']();
        this.specMap.set(btn, spec);
        this.itemMap.set(key, btn);
    };

    private parseTemplate(text: string) {
        return text.replace(/\{[\w.]+\}/g, (expr) => {
            const key = expr.slice(1, expr.length - 1);
            const val = this.ctx.get<any>(key);
            if (val !== undefined) {
                return val;
            }
            return expr;
        });
    }

    private evalWhen(when?: When): boolean {
        if (typeof when === 'function') {
            return when(this.ctx);
        }

        if (typeof when === 'string') {
            return this.ctx.testExpr(when);
        }
        return true;
    }

    private subscribeToContext(): vscode.Disposable {
        return this.ctx.onChange(() => {
            for (const item of this.itemMap.values()) {
                const additional = this.specMap.get(item);
                if (additional?.text) {
                    item.text = this.parseTemplate(additional.text);
                }
                this.evalWhen(additional?.when) ? item.show() : item.hide();
            }
        }, 50);
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
        const btn = this.itemMap.get(key)!;
        Object.assign(btn, payload);
        if (payload.text) {
            const spec = this.specMap.get(btn);
            if (spec) {
                Object.assign(spec, payload);
            }
            btn.text = this.parseTemplate(payload.text);
        }
    };
}
