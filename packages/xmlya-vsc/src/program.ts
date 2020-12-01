import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Player } from './containers/player';
import { App } from './containers/app';
import { Logger, LogLevel } from './lib';

export class Program {
    private sdk: XmlyaSDK;
    private app: App;
    private player: Player;
    constructor(private context: vscode.ExtensionContext) {
        // set level
        Logger.Level = context.extensionMode === vscode.ExtensionMode.Production ? LogLevel.info : LogLevel.debug;
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.app = new App(this.sdk);
        this.player = new Player(this.sdk);

        this.context.subscriptions.push(vscode.Disposable.from(this.app, this.player));
    }

    run() {
        this.app.runInContext(this.context);
        this.player.runInContext(this.context);
    }
}
