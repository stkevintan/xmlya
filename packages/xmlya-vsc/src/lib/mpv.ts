import { Mpv } from '@xmlya/mpv';
import { Configuration } from 'src/configuration';
import { ContextService } from 'src/context';
import { Logger, LogLevel } from './logger';
import which from 'which';
import path from 'path';
import { promises as fs, existsSync, createWriteStream } from 'fs';
import * as vscode from 'vscode';
import fetch from 'node-fetch';

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

        const bin = await tryDownloadBinary(context.globalStoragePath, 'mpv');
        if (bin) {
            return bin;
        }
        throw new Error('Failed to find the mpv binary, please install it first: https://mpv.io/installation/');
    }
}

function getPrebuiltBinaries(os: string) {
    if (os.startsWith('darwin-')) {
        return 'https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-latest.tar.gz';
    }
    return null;
}

async function tryDownloadBinary(dir: string, filename: string): Promise<string | null> {
    const os = `${process.platform}-${process.arch}`;
    const target = getPrebuiltBinaries(os);
    if (!target) {
        return null;
    }

    const choice = await vscode.window.showInformationMessage(
        'vscode-xmlya need download mpv as the playback service: https://mpv.io/',
        'Dowload it',
        'Not now'
    );
    if (choice === 'Not now') {
        return null;
    }
    await fs.mkdir(dir, { recursive: true }).catch((err) => {});

    const response = await fetch(target);
    if (response.body == null) {
        throw new Error(
            `failed to download mpv binary from ${target}, please install by yourself. https://mpv.io/installation/`
        );
    }

    const filepath = path.resolve(dir, filename);
    const fstream = createWriteStream(filepath);
    await new Promise((resolve, reject) => {
        response.body!.pipe(fstream);
        response.body!.on('error', reject);
        fstream.on('finish', resolve);
    });
    return filepath;
}
