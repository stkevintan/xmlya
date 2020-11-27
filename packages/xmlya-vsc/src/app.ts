import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Player } from './player';
import { Interactor } from './interactor';

export class App {
    private sdk: XmlyaSDK;
    private interactor: Interactor;
    private player: Player;
    constructor(private context: vscode.ExtensionContext) {
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.interactor = new Interactor(this.sdk);
        this.player = new Player(this.sdk);
        this.context.subscriptions.push({ dispose: this.stop });
    }

    run() {
        this.interactor.runInContext(this.context);
        this.player.runInContext(this.context);
    }

    stop = () => {
        this.interactor.dispose();
        this.player.dispose();
    };
}
