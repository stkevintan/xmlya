import * as vscode from 'vscode';

// function assertConfValue(x: any, message?: string): asserts x {
//     if (x === undefined) {
//         if (message) {
//             vscode.window.showErrorMessage(message);
//         }
//         throw new TypeError('value assert failed');
//     }
// }

export class Configuration {
    static get cookie(): string | undefined {
        const ret = vscode.workspace.getConfiguration().get<string>('xmlya.cookie');
        if (!ret) {
            vscode.window.showWarningMessage("Please set `xmlya.cookie` to archive best user experience");
        }
        return ret;
    }
}
