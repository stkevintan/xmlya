import * as vscode from 'vscode';
import { App } from './app';
import 'reflect-metadata';

export function activate(context: vscode.ExtensionContext) {
    const app = new App(context);
    app.run();
}

export function deactivate() {}
