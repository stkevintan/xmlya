import { RuntimeContext, When } from 'src/lib';
import { Logger } from 'src/lib/logger';
import * as vscode from 'vscode';

export interface IStatusBarItemSpec {
    key: string;
    text: string;
    tooltip?: string;
    color?: string | vscode.ThemeColor;
    command?: string | [string, ...any];
    accessibilityInformation?: vscode.AccessibilityInformation;
    when?: When;
}

export class StatusBar extends vscode.Disposable {
    private items: vscode.StatusBarItem[] = [];

    private subscriptions: vscode.Disposable[] = [];
    constructor(private specs: IStatusBarItemSpec[], private priorityBase: number) {
        super(() => {
            vscode.Disposable.from(...this.subscriptions, ...this.items);
        });
    }

    activate(ctx: RuntimeContext) {
        this.render(ctx);
        this.subscriptions.push(ctx.onChange(this.render.bind(this, ctx), 50));
    }

    private render(ctx: RuntimeContext) {
        let itemIndex = 0;
        for (const spec of this.specs.filter((spec) => ctx.testWhen(spec.when))) {
            const item = this.items[itemIndex] ?? this.createNewItem();
            item.text = ctx.parseString(spec.text);
            item.tooltip = spec.tooltip;
            item.color = spec.color;
            item.command = this.makeCommand(spec.command);
            item.show();
            itemIndex++;
        }

        // hide the rest
        for (; itemIndex < this.items.length; itemIndex++) {
            this.items[itemIndex].hide();
        }
    }

    private createNewItem(): vscode.StatusBarItem {
        return vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            this.priorityBase + this.items.length
        );
    }

    private makeCommand(command: IStatusBarItemSpec['command']): vscode.StatusBarItem['command'] {
        if (!command) return undefined;
        return typeof command === 'string' ? command : { command: command[0], arguments: command.slice(1), title: '' };
    }

    // addItem = (key: string, spec: IStatusBarItemSpec): void => {
    //     Logger.assertTrue(!this.itemMap.has(key), `Duplicated key ${key} when creating status bar item`);

    //     const btn = vscode.window.createStatusBarItem(
    //         spec.alignment || vscode.StatusBarAlignment.Right,
    //         this.priorityBase + this.itemMap.size
    //     );
    //     btn.text = this.parseTemplate(spec.text);
    //     btn.tooltip = spec.tooltip;
    //     btn.color = spec.color;
    //     btn.command = spec.command;
    //     btn[this.evalWhen(spec.when) ? 'show' : 'hide']();
    //     this.specMap.set(btn, spec);
    //     this.itemMap.set(key, btn);
    // };

    // private subscribeToContext(): vscode.Disposable {
    //     return this.ctx.onChange(() => {
    //         for (const item of this.itemMap.values()) {
    //             const additional = this.specMap.get(item);
    //             if (additional?.text) {
    //                 item.text = this.parseTemplate(additional.text);
    //             }
    //             this.evalWhen(additional?.when) ? item.show() : item.hide();
    //         }
    //     }, 50);
    // }

    // updateItem = (
    //     key: string,
    //     payload: Partial<
    //         Pick<
    //             IStatusBarItemSpec,
    //             'color' | 'alignment' | 'accessibilityInformation' | 'text' | 'tooltip' | 'command'
    //         >
    //     >
    // ): void => {
    //     if (!this.itemMap.has(key)) {
    //         return;
    //     }
    //     const btn = this.itemMap.get(key)!;
    //     Object.assign(btn, payload);
    //     if (payload.text) {
    //         const spec = this.specMap.get(btn);
    //         if (spec) {
    //             Object.assign(spec, payload);
    //         }
    //         btn.text = this.parseTemplate(payload.text);
    //     }
    // };
}
