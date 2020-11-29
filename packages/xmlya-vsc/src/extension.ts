import * as vscode from 'vscode';
import { App } from './app';

export function activate(context: vscode.ExtensionContext) {
    const app = new App(context);
    app.run();
}
