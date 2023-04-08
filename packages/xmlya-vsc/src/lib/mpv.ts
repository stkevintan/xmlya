import { Mpv } from '@xmlya/mpv';
import { ConfigKeys, Configuration } from 'src/configuration';
import { ContextService } from 'src/context';
import { Logger, LogLevel } from './logger';
import which from 'which';
import * as vscode from 'vscode';
import { BinaryProvider, findMatchedBinaryProvider } from './binaryManager';
import { formatSize } from './common';

export async function startMpv(context: ContextService) {
    const logLevel = LogLevel[Logger.Level] as any;
    const logger = new Logger('mpv client');
    const root = context.extension.globalStorageUri;
    const mpvBinary = await detectMpvBinary();
    if (!mpvBinary) return;
    const mpv = await Mpv.create({
        mpvBinary,
        args: Configuration.mpvAguments,
        volume: context.extension.globalState.get('xmlya.player.volume'),
        speed: context.extension.globalState.get('xmlya.player.speed'),
        mute: context.extension.globalState.get('xmlya.player.isMuted'),
        logLevel,
        logger,
    });

    context.extension.subscriptions.push(syncStatus(mpv), syncConfig(mpv));

    return mpv;

    async function detectMpvBinary() {
        if (Configuration.mpvBinary) {
            logger.info(Configuration.mpvBinary);
            return Configuration.mpvBinary;
        }

        logger.info('looking for mpv binary at:', root.fsPath);
        const provider = findMatchedBinaryProvider(root.fsPath);
        if (provider && provider.checkBinary()) {
            return provider.binaryPath;
        }

        const systemBin = which.sync('mpv', { nothrow: true });
        if (systemBin) {
            return systemBin;
        }

        if (provider) {
            logger.info('trying to download mpv binary');
            return await tryDownloadBinary(provider);
        }
        throw new Error('Failed to find the mpv binary, please install it first: https://mpv.io/installation/');
    }

    async function tryDownloadBinary(provider: BinaryProvider): Promise<string | undefined> {
        const cancelLabel = 'Cancel';
        const okLabel = 'Install';
        const choice = await vscode.window.showInformationMessage(
            'Ximalaya requires mpv as the playback service: https://mpv.io/',
            okLabel,
            cancelLabel
        );
        if (choice === cancelLabel) {
            return;
        }
        Logger.Channel?.show();
        provider.onSizeobtained((size) => logger.info('binary size:', formatSize(size)));
        provider.onProgress((progress) => logger.info('download percentage:', `${progress} %`));
        return await provider.download();
    }

    function syncStatus(mpv: Mpv): vscode.Disposable {
        // add watches
        return vscode.Disposable.from(
            mpv.watch<boolean>('core-idle', (active) => {
                if (!active) context.set('player.readyState', 'playing');
            }),
            mpv.watch<boolean>('idle-active', (active) => {
                if (active) context.set('player.readyState', 'idle');
            }),
            mpv.watch<boolean>('mute', (mute) => {
                context.set('player.isMuted', !!mute);
                void context.extension.globalState.update('xmlya.player.isMuted', !!mute);
            }),

            mpv.watch<boolean>('seek', (seeking) => {
                if (seeking) context.set('player.readyState', 'seeking');
            }),
            mpv.watch<number>('volume', (volume) => {
                context.set('player.volume', volume);
                void context.extension.globalState.update('xmlya.player.volume', volume);
            }),
            // too many logs.
            // mpv.watch<number>('time-remaining', (countdown) => {
            //     countdown = Math.ceil(countdown);
            //     const prevRemaining = context.get<number>('player.timeRemaining');
            //     if (prevRemaining === countdown) return;
            //     context.set('player.timeRemaining', countdown);
            //     context.set('player.timeRemainingFormatted', formatDuration(countdown));
            // }),
            mpv.watch<number>('speed', (speed) => {
                context.set('player.speed', speed);
                void context.extension.globalState.update('xmlya.player.speed', speed);
            }),
            mpv.on('start-file', () => {
                context.set('player.readyState', 'loading');
            }),
            mpv.on('pause', () => {
                context.set('player.readyState', 'paused');
            }),
            mpv.on('end-file', (data) => {
                context.set('player.readyState', 'playend');
                if (['error', 'unknown'].includes(data.reason)) {
                    context.set('player.readyState', 'error');
                } else if (data.reason === 'eof') {
                    // try to play next track.
                    void vscode.commands.executeCommand('xmlya.player.goNext');
                }
            })
        );
    }
    function syncConfig(mpv: Mpv) {
        const syncStart = () => {
            const { playbackStart } = Configuration;
            void mpv.startOffset(playbackStart ? `+${Configuration.playbackStart}` : 'none');
        };
        const syncEnd = () => {
            const { playbackEnd } = Configuration;
            void mpv.endOffset(playbackEnd ? `-${Configuration.playbackEnd}` : 'none');
        };
        syncStart();
        syncEnd();
        return Configuration.onUpdate((keys) => {
            if (keys.includes(ConfigKeys.PlaybackStart)) {
                syncStart();
            }
            if (keys.includes(ConfigKeys.PlaybackEnd)) {
                syncEnd();
            }
        });
    }
}
