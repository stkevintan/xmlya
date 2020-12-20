import ansiEscapes from 'ansi-escapes';
import * as vscode from 'vscode';

export enum TerminalEvents {
    Open = 'terminal:open',
    Close = 'terminal:close',
    Show = 'terminal:show',
    Hide = 'terminal.hide',
}

export class Terminal extends vscode.EventEmitter<TerminalEvents> {
    private readonly writer = new vscode.EventEmitter<string>();
    private readonly terminal: vscode.Terminal;
    private isShow = false;
    private dim?: vscode.TerminalDimensions;
    constructor(readonly name = 'Ximalaya') {
        super();
        const pty: vscode.Pseudoterminal = {
            onDidWrite: this.writer.event,
            close: () => {
                this.writer.fire(ansiEscapes.cursorShow);
                this.fire(TerminalEvents.Close);
            },
            open: (dim) => {
                this.dim = dim;
                this.writer.fire(ansiEscapes.cursorHide);
                this.fire(TerminalEvents.Open);
            },
        };
        this.terminal = vscode.window.createTerminal({ name: this.name, pty });
    }

    get columns() {
        return this.dim?.columns;
    }

    private setShown(shown: boolean) {
        this.fire(TerminalEvents[shown ? 'Show' : 'Hide']);
        this.isShow = shown;
    }

    get shown() {
        return this.isShow;
    }
    show() {
        this.terminal.show();
        this.setShown(true);
    }

    hide() {
        this.terminal.hide();
        this.setShown(false);
    }

    append(text: string) {
        this.writer.fire(text);
    }

    appendLine(text: string = '') {
        this.writer.fire(text + '\n\r');
    }

    eraseLine(count = 1) {
        this.append(ansiEscapes.eraseLines(count));
    }

    clear() {
        this.append(ansiEscapes.clearScreen);
    }

    dispose() {
        super.dispose();
        this.terminal.dispose();
    }
}
