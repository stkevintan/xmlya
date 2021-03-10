import { ConfigKeys, Configuration } from 'src/configuration';
import { ContextService, When } from 'src/context';
import { ellipsis } from 'src/lib';
import { debounce } from 'throttle-debounce-ts';
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
    private patchedSpecs: IStatusBarItemSpec[] = [];
    constructor(private specs: IStatusBarItemSpec[], private priorityBase: number) {
        super(() => {
            vscode.Disposable.from(...this.subscriptions, ...this.items);
        });
    }

    private patchSpec(patchArr: Partial<IStatusBarItemSpec>[]) {
        this.patchedSpecs = [...this.specs];
        for (const p of patchArr) {
            const index = this.patchedSpecs.findIndex((spec) => spec.key === p.key);
            if (index === -1) continue;
            this.patchedSpecs[index] = Object.assign({}, this.patchedSpecs[index], p);
        }
        return this.patchedSpecs;
    }

    renderWith(ctx: ContextService, scope?: string) {
        this.patchSpec(Configuration.playctrls);
        this.repaint(ctx);
        this.subscriptions.push(
            ctx.onChange(
                debounce(100, (keys: string[]) => {
                    if (this.matchScope(keys, scope)) {
                        this.repaint(ctx);
                    }
                })
            )
        );
        this.subscriptions.push(
            Configuration.onUpdate((changedKeys) => {
                if (changedKeys.includes(ConfigKeys.PlayCtrls)) {
                    const { playctrls } = Configuration;
                    console.debug('playctrls are changed', playctrls);
                    this.patchSpec(playctrls);
                    this.repaint(ctx);
                }
            })
        );
    }

    private matchScope(keys: string[], scope?: string): boolean {
        if (!scope) return true;
        return keys.some((key) => key.startsWith(scope + '.'));
    }

    // TODO: implement an efficient diff algorithm.
    private repaint(ctx: ContextService) {
        let itemIndex = 0;
        for (const spec of this.patchedSpecs.filter((spec) => ctx.testWhen(spec.when))) {
            const item = this.items[itemIndex] ?? this.createNewItem();
            item.text = ellipsis(ctx.parseString(spec.text), 20);
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
