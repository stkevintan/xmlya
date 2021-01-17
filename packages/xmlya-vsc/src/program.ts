import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Player } from './containers/player';
import { App } from './containers/app';
import { ContextService } from './context';
import { Common } from './containers/common';
import { Sidebar } from './containers/sidebar';

export class Program {
    private sdk: XmlyaSDK;
    private app: App;
    private player: Player;
    private common: Common;
    private context: ContextService;
    private sidebar: Sidebar;
    constructor(_context: vscode.ExtensionContext) {
        this.context = new ContextService(_context);
        const client = new Client({ cookie: () => Configuration.cookie });
        this.sdk = new XmlyaSDK(client);
        this.common = new Common(this.sdk);
        this.app = new App(this.sdk);
        this.player = new Player(this.sdk);
        this.sidebar = new Sidebar(this.sdk);
    }

    run() {
        void this.common.runInContext(this.context);
        void this.app.runInContext(this.context);
        void this.player.runInContext(this.context);
        void this.sidebar.runInContext(this.context);
    }
}
