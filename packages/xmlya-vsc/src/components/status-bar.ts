import { ContextService, When } from 'src/context-service';
import { debounce } from 'ts-debounce';
import * as vscode from 'vscode';

export interface IStatusBarItemSpec {
    key: string;
    text: string;
    tooltip?: string;
    color?: string | vscode.ThemeColor;
    command?: string;
    arguments?: any[];
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

    renderWith(ctx: ContextService, scope?: string) {
        this.repaint(ctx);
        this.subscriptions.push(
            ctx.onChange(
                debounce((keys) => {
                    if (this.matchScope(keys, scope)) {
                        this.repaint(ctx);
                    }
                }, 50)
            )
        );
    }

    private matchScope(keys: string[], scope?: string): boolean {
        if (!scope) return true;
        return keys.some((key) => key.startsWith(scope + '.'));
    }

    // TODO: implement an efficient diff algorithm.
    private repaint(ctx: ContextService) {
        let itemIndex = 0;
        for (const spec of this.specs.filter((spec) => ctx.testWhen(spec.when))) {
            const item = this.items[itemIndex] ?? this.createNewItem();
            item.text = ctx.parseString(spec.text);
            item.tooltip = spec.tooltip;
            item.color = spec.color;
            item.command = this.makeCommand(spec.command, spec.arguments);
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
            this.priorityBase - this.items.length
        );
        // do not forget push it to the items
        this.items.push(item);
        return item;
    }

    private makeCommand(command?: string, _arguments?: any[]): vscode.StatusBarItem['command'] {
        if (!command) return undefined;
        return _arguments ? { command, arguments: _arguments, title: '' } : command;
    }
}
