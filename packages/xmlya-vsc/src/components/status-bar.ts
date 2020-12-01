import { RuntimeContext, When } from 'src/lib';
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
        const item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            this.priorityBase + this.items.length
        );
        // do not forget push it to the items
        this.items.push(item);
        return item;
    }

    private makeCommand(command: IStatusBarItemSpec['command']): vscode.StatusBarItem['command'] {
        if (!command) return undefined;
        return typeof command === 'string' ? command : { command: command[0], arguments: command.slice(1), title: '' };
    }
}
