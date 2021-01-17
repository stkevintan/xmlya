import * as vscode from 'vscode';

export class TreeNode extends vscode.TreeItem {
    getChildren(): vscode.ProviderResult<TreeNode[]> {
        return null;
    }

    setIcon(iconPath: TreeNode['iconPath']) {
        this.iconPath = iconPath;
        return this;
    }

    setCommand(command: string, ...args: any[]) {
        this.command = { command, arguments: args, title: '' };
        return this;
    }

    setDescription(desc?: string) {
        this.description = desc;
        return this;
    }

    setContxtValue(contextValue?: string) {
        this.contextValue = contextValue;
        return this;
    }
}
