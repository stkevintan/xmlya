import { Mpv } from '@xmlya/mpv';
import { Configuration } from 'src/configuration';
import { ContextService } from 'src/context';
import { Logger, LogLevel } from './logger';
import which from 'which';
import * as vscode from 'vscode';
import { BinaryProvider, findMatchedBinaryProvider } from 'src/binaryManager';
import { formatSize } from './common';

export async function createMpvInstance(context: ContextService) {
    const logLevel = LogLevel[Logger.Level] as any;
    const logger = new Logger('mpv client');
    const root = context.globalStoragePath;
    const mpvBinary = await detectMpvBinary();
    if (!mpvBinary) return;
    return await Mpv.create({
        mpvBinary: await detectMpvBinary(),
        args: Configuration.mpvAguments,
        volume: context.globalState.get('xmlya.player.volume'),
        speed: context.globalState.get('xmlya.player.speed'),
        mute: context.globalState.get('xmlya.player.isMuted'),
        logLevel,
        logger,
    });

    async function detectMpvBinary() {
        if (Configuration.mpvBinary) {
            logger.info(Configuration.mpvBinary);
            return Configuration.mpvBinary;
        }

        logger.info('looking for mpv binary at:', root);
        const provider = findMatchedBinaryProvider(root);
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
}
