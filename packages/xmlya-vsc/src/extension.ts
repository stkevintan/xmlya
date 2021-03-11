import { Client, XmlyaSDK } from '@xmlya/sdk';
import * as vscode from 'vscode';
import { Configuration } from './configuration';
import { Common } from './containers/common';
import { Player } from './containers/player';
import { View } from './containers/views';
import { ContextService } from './context';
import { Logger, startMpv } from './lib';

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
        const mpv = await startMpv(context);
        if (mpv) {
            //setup components
            new Common(sdk, context).run();
            new Player(mpv, sdk, context).run();
            new View(mpv, sdk, context).run();
        }
    } catch (err) {
        // show error
        void vscode.window.showErrorMessage(err.message);
    }
}
