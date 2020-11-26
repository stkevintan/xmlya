import { Runnable } from './runnable';

import * as vscode from 'vscode';
import { AppContext } from './app-context';

interface ICtrlButtonSpec {
    icon: string;
    title?: string;
    when?: (() => boolean) | string;
    command?: string;
}

const controllers: ICtrlButtonSpec[] = [
    {
        title: 'Previous track',
        icon: '$(chevron-left)',
        command: 'xmlya.player.goPrev',
        when: 'player.hasPrev',
    },
    {
        title: 'Next track',
        icon: '$(chevron-right)',
        command: 'xmlya.palyer.goNext',
        when: 'player.hasNext',
    },
    {
        title: 'Play',
        icon: '$(play)',
        command: 'xmlya.player.play',
        when: 'player.isPausing',
    },
    {
        title: 'Pause',
        icon: '$(primitive-square)',
        command: 'xmlya.player.pause',
        when: 'player.isPlaying',
    },
    {
        title: 'Ximalaya: Menu',
        icon: '$(rocket) Ximalaya Start',
        command: 'xmlya.user.menu',
    },
];

export class Controller extends Runnable {
    private priBase = 600;
    private subscriptions: vscode.Disposable[] = [];
    private createButton = (spec: ICtrlButtonSpec): vscode.StatusBarItem => {
        const btn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, this.priBase++);
        btn.text = spec.icon;
        btn.tooltip = spec.title;
        btn.command = spec.command;
        this.subscriptions.push(AppContext.onDidContextChange(evaluateWhen));
        evaluateWhen();
        this.subscriptions.push(btn);
        return btn;
        function evaluateWhen() {
            if (typeof spec.when === 'function') {
                return spec.when() ? btn.show() : btn.hide();
            }
            if (typeof spec.when === 'string') {
                return AppContext.getContext(spec.when) ? btn.show() : btn.hide();
            }
            btn.show();
        }
    };

    constructor() {
        super(() => {
            this.subscriptions.forEach((sub) => sub.dispose());
        });
        controllers.map(this.createButton);
    }
}
