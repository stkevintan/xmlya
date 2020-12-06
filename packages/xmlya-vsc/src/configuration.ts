import * as vscode from 'vscode';
import { IStatusBarItemSpec } from './components/status-bar';
import { Callback, omitNillKeys, isntNil, isNil } from './lib';
import { Logger } from './lib/logger';

export enum ConfigKeys {
    Cookie = 'xmlya.cookie',
    MpvBinary = 'xmlya.mpvBinary',
    PlayCtrls = 'xmlya.playctrls',
    PlaybackStart = 'xmlya.playbackStart',
    PlaybackEnd = 'xmlya.playbackEnd',
    MpvArguments = 'xmlya.mpvArguments',
    StatusBarItemBase = 'xmlya.statusBarItemBase',
}

export class Configuration {
    static get wsconf() {
        return vscode.workspace.getConfiguration();
    }

    static onUpdate = (cb: Callback<ConfigKeys[]>, section?: string) => {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            const keys: ConfigKeys[] = [];
            for (const key of Object.values(ConfigKeys)) {
                if (e.affectsConfiguration(key)) {
                    keys.push(key);
                }
            }

            if (keys.length) {
                cb(keys);
            }
        });
    };

    static get<T = string>(key: ConfigKeys): T | undefined {
        return this.wsconf.get<T>(key);
    }

    static get cookie(): string | undefined {
        const ret = this.get(ConfigKeys.Cookie);
        if (ret === undefined) {
            Logger.warn('Please set `xmlya.cookie` to archive best user experience');
        }
        return ret;
    }

    static get mpvBinary(): string | undefined {
        return this.get(ConfigKeys.MpvBinary);
    }

    static get mpvAguments(): string[] {
        return this.get<string[]>(ConfigKeys.MpvArguments) ?? [];
    }

    static get statusBarItemBase(): number {
        return this.get<number>(ConfigKeys.StatusBarItemBase) ?? -100;
    }

    static get isDebugColorOverrided(): boolean {
        return this.wsconf.get('workbench.colorCustomizations.debugIcon') === undefined;
    }

    static get playctrls(): Partial<IStatusBarItemSpec>[] {
        const ctrls = this.get<Record<string, any>[]>(ConfigKeys.PlayCtrls) ?? [];
        if (!Array.isArray(ctrls)) return [];
        return ctrls.map((ctrl) => normalizePatch(ctrl)).filter(isntNil);

        function normalizePatch(patch: Record<string, any>): Partial<IStatusBarItemSpec | null> {
            // key must be present
            if (!patch || !patch.key) return null;
            return omitNillKeys({
                key: toString(patch.key),
                text: toString(patch.text),
                tooltip: toString(patch.tooltip),
                color: handleColor(patch.color),
                accessibilityInformation: patch.accessibilityInformation,
                when: toString(patch.when),
            });
        }

        function toString(item?: any): string | undefined {
            return item ? `${item}` : undefined;
        }

        function handleColor(color?: string): string | vscode.ThemeColor | undefined {
            if (!color) return undefined;
            if (typeof color !== 'string') return undefined;

            if (/^#[a-zA-Z0-9]+/.test(color)) {
                return color;
            }
            return new vscode.ThemeColor(color);
        }
    }

    static get playbackStart(): string | number | undefined {
        let start = this.get(ConfigKeys.PlaybackStart);
        return typeof start === 'number' && start >= 0 ? start : undefined;
    }

    static get playbackEnd(): string | number | undefined {
        let end = this.get(ConfigKeys.PlaybackEnd);
        return typeof end === 'number' && end >= 0 ? end : undefined;
    }
}
