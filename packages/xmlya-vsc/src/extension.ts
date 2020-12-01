import * as vscode from 'vscode';
import { Program } from './program';

export function activate(context: vscode.ExtensionContext) {
    const program = new Program(context);
    program.run();
}
