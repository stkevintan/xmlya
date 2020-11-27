import * as vscode from 'vscode';
import { Logger } from './lib/logger';

export class Configuration {
    static get cookie(): string | undefined {
        const ret = vscode.workspace.getConfiguration().get<string>('xmlya.cookie');
        if (ret === undefined) {
            Logger.warn('Please set `xmlya.cookie` to archive best user experience');
        }
        return ret;
    }

    static get mpvBinary(): string | undefined {
        return vscode.workspace.getConfiguration().get<string>('xmlya.mpvBinary');
    }
}
