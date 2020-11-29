import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Player } from './player';
import { Interactor } from './interactor';
import { Logger, LogLevel } from './lib';

export class App {
    private sdk: XmlyaSDK;
    private interactor: Interactor;
    private player: Player;
    constructor(private context: vscode.ExtensionContext) {
        // set level
        Logger.Level = context.extensionMode === vscode.ExtensionMode.Production ? LogLevel.info : LogLevel.debug;
        const client = new Client({ cookie: Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.interactor = new Interactor(this.sdk);
        this.player = new Player(this.sdk);

        this.context.subscriptions.push(vscode.Disposable.from(this.interactor, this.player));
    }

    run() {
        this.interactor.runInContext(this.context);
        this.player.runInContext(this.context);
    }
}
