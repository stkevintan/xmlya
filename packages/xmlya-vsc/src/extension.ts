import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { User } from './containers/user';
import { Player } from './containers/player';
import { Sidebar } from './containers/sidebar';
import { ContextService } from './context';
import { Logger, createMpvInstance } from './lib';

export async function activate(_context: vscode.ExtensionContext) {
    try {
        const context = new ContextService(_context);
        // setup channel.
        const channel = vscode.window.createOutputChannel('xmlya');
        context.subscriptions.push(channel);
        Logger.Channel = channel;

        //setup sdk
        const client = new Client({ cookie: () => Configuration.cookie });
        const sdk = new XmlyaSDK(client);

        //setup mpv
        const mpv = await createMpvInstance(context);
        if (mpv) {
            //setup components
            new User(sdk, context).run();
            new Player(mpv, sdk, context).run();
            new Sidebar(sdk, context).run();
        }
    } catch (err) {
        // show error
        void vscode.window.showErrorMessage(err.message);
    }
}
