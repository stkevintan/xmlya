import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Interactor } from './interaction';

export class App {
    private sdk: XmlyaSDK;
    private interactor: Interactor;
    constructor(private context: vscode.ExtensionContext) {
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.interactor = new Interactor(this.sdk);
    }

    run() {
        this.interactor.register(this.context);
    }
}
