import { Mpv } from '@xmlya/mpv';
import { Configuration } from 'src/configuration';
import { ContextService } from 'src/context';
import { Logger, LogLevel } from './logger';
import which from 'which';
import path from 'path';
import { promises as fs, existsSync } from 'fs';
import * as vscode from 'vscode';
import { download, DownloadEvent } from './downloader';

export async function createMpv(context: ContextService) {
    const logLevel = LogLevel[Logger.Level] as any;
    const logger = new Logger('mpv client');
    return await Mpv.create({
        mpvBinary: await queryMpvBinary(),
        args: Configuration.mpvAguments,
        volume: context.globalState.get('xmlya.player.volume'),
        speed: context.globalState.get('xmlya.player.speed'),
        mute: context.globalState.get('xmlya.player.isMuted'),
        logLevel,
        logger,
    });

    async function queryMpvBinary() {
        if (Configuration.mpvBinary) {
            logger.info(Configuration.mpvBinary);
            return Configuration.mpvBinary;
        }
        // looking into the globalStorage:
        const localBin = path.resolve(context.globalStoragePath, './mpv');
        logger.info('looking for mpv binary at local:', localBin);
        if (existsSync(localBin)) {
            return localBin;
        }

        const systemBin = which.sync('mpv', { nothrow: true });
        if (systemBin) {
            return systemBin;
        }

        const bin = await tryDownloadBinary(context.globalStoragePath, logger);
        if (bin) {
            return bin;
        }
        throw new Error('Failed to find the mpv binary, please install it first: https://mpv.io/installation/');
    }
}

function getPrebuiltBinaries(os: string): { target: string; binPath: string } | undefined {
    if (os.startsWith('darwin-')) {
        return {
            target: 'https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-latest.tar.gz',
            binPath: './Contents/MacOS/mpv',
        };
    }
    return undefined;
}

async function tryDownloadBinary(dir: string, logger: Logger): Promise<string | null> {
    const os = `${process.platform}-${process.arch}`;
    const binaryInfo = getPrebuiltBinaries(os);
    if (!binaryInfo) {
        return null;
    }
    const { target, binPath } = binaryInfo;

    const choice = await vscode.window.showInformationMessage(
        'vscode-xmlya need download mpv as the playback service: https://mpv.io/',
        'Dowload it',
        'Not now'
    );
    if (choice === 'Not now') {
        return null;
    }

    await fs.mkdir(dir, { recursive: true }).catch((err) => {});

    const downloadEvent = new vscode.EventEmitter<DownloadEvent>();

    downloadEvent.event((ev) => {
        logger.info(ev.type + ':', ev.value);
    });

    await download(target, { directory: dir, downloadEvent });

    return path.resolve(dir, binPath);
}
