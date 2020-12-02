import * as vscode from 'vscode';
import { Program } from './program';

export function activate(context: vscode.ExtensionContext) {
    new Program(context).run();
}
