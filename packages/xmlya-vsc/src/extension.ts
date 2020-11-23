import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const helloWorld = vscode.commands.registerCommand("extension.helloworld", async () => {
        vscode.window.showInformationMessage("Hello");
    });
    context.subscriptions.push(helloWorld);
}

export function deactivate() {
    
}