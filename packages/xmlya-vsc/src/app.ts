import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { QuickPicker } from './quick-picker';

export class App {
    private sdk: XmlyaSDK;
    private quickPicker: QuickPicker;
    constructor(private context: vscode.ExtensionContext) {
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.quickPicker= new QuickPicker(this.sdk);
    }

    run() {
        this.quickPicker.runInContext(this.context);
    }

    stop() {
        this.quickPicker.dispose();
    }
}
