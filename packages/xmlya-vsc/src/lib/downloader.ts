import https from 'https';
import { pipeline } from 'stream';
import { EventEmitter } from 'vscode';
import { promisify } from 'util';
import { IncomingMessage } from 'http';
import gunzip from 'gunzip-maybe';
import tar from 'tar';

const pipe = promisify(pipeline);

export type DownloadEvent =
    | {
          type: 'DownloadSizeObtained';
          value: number;
      }
    | {
          type: 'DownloadProgress';
          value: number;
      };

export interface IDownloadOptions {
    directory: string;
    downloadEvent?: EventEmitter<DownloadEvent>;
}

export async function download(url: string, options: IDownloadOptions): Promise<void> {
    const res = await new Promise<IncomingMessage>((resolve, reject) => {
        const req = https.request(url, (res) => resolve(res));
        req.on('error', (err) => reject(`Request error ${err.message || 'NONE'}`));
        req.end();
    });

    await new Promise<void>((resolve, reject) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
            return resolve(download(res.headers.location!, options));
        }

        if (res.statusCode !== 200) {
            throw new Error(`Failed to download from ${url}. Error code: ${res.statusCode}`);
        }

        const packageSize = Number.parseInt(res.headers['content-length']!, 10);
        let downloadedBytes = 0;
        let downloadPercent = 0;
        // let buffers: any[] = [];
        options.downloadEvent?.fire({ type: 'DownloadSizeObtained', value: packageSize });

        res.on('data', (data) => {
            downloadedBytes += data.length;
            let newPercent = Math.ceil(100 * (downloadedBytes / packageSize));
            if (newPercent !== downloadPercent) {
                downloadPercent = newPercent;
                options.downloadEvent?.fire({ type: 'DownloadProgress', value: downloadPercent });
            }
        });

        resolve(pipe(res, gunzip(), tar.extract({ strip: 1, C: options.directory })));
    });
}
