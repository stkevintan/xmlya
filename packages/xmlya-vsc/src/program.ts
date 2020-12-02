import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { ConfigKeys, Configuration } from './configuration';
import { Player } from './containers/player';
import { App } from './containers/app';
import { ContextService } from './context';

export class Program {
    private sdk: XmlyaSDK;
    private app: App;
    private player: Player;
    private context: ContextService;
    constructor(_context: vscode.ExtensionContext) {
        this.context = new ContextService(_context);
        const client = new Client({ cookie: () => Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.app = new App(this.sdk);
        this.player = new Player(this.sdk);
    }

    run() {
        this.app.runInContext(this.context);
        this.player.runInContext(this.context);
    }
}
