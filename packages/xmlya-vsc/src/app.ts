import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Controller } from './controller';
import { Interactor } from './interactor';

export class App {
    private sdk: XmlyaSDK;
    private interactor: Interactor;
    private controller: Controller;
    constructor(private context: vscode.ExtensionContext) {
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.interactor = new Interactor(this.sdk);
        this.controller = new Controller();
        this.context.subscriptions.push({ dispose: this.stop });
    }

    run() {
        this.interactor.runInContext(this.context);
        this.controller.runInContext(this.context);
    }

    stop = () => {
        this.interactor.dispose();
        this.controller.dispose();
    };
}
