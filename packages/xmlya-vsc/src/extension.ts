import * as vscode from 'vscode';
import { App } from './app';
import 'reflect-metadata';

let app: App;
export function activate(context: vscode.ExtensionContext) {
    app = new App(context);
    app.run();
}

export function deactivate() {
    app?.stop();
}
