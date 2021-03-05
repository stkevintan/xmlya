import https from 'https';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'vscode';
import fs from 'fs';
import path from 'path';

export abstract class BinaryProvider {
    protected directory: string;

    constructor(root: string) {
        this.directory = path.resolve(root, './lib');
        try {
            fs.mkdirSync(this.directory, { recursive: true });
        } catch (e) {}
    }

    protected abstract packageUrl: string;
    abstract isMatch(): boolean;
    protected abstract take(res: IncomingMessage): Promise<void>;
    abstract get binaryPath(): string;

    checkBinary(): boolean {
        try {
            const stat = fs.statSync(this.binaryPath);
            if (!stat.isFile()) return false;
            if (process.platform === 'win32') return true;
            return (
                !!(stat.mode & 0o0001) ||
                (!!(stat.mode & 0o0010) && stat.gid === process.getgid()) ||
                (!!(stat.mode & 0o0100) && stat.uid === process.getuid())
            );
        } catch (e) {
            return false;
        }
    }

    private sizeObtainedEvent = new EventEmitter<number>();
    private progressEvent = new EventEmitter<number>();

    readonly onSizeobtained = this.sizeObtainedEvent.event;
    readonly onProgress = this.progressEvent.event;

    private clear() {
        try {
            fs.rmSync(this.directory, { recursive: true, force: true });
        } catch (e) {}
    }
    async download(): Promise<string> {
        await this._download(this.packageUrl);
        if (!this.checkBinary()) {
            this.clear();
            throw new Error('the downloaded binary is not executable.');
        }
        return this.binaryPath;
    }

    private async _download(url: string) {
        return await new Promise<void>((resolve, reject) => {
            const req = https.request(url, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return resolve(this._download(res.headers.location!));
                }

                if (res.statusCode !== 200) {
                    throw new Error(`Failed to download from ${url}. Error code: ${res.statusCode}`);
                }

                const packageSize = Number.parseInt(res.headers['content-length']!, 10);
                let downloadedBytes = 0;
                let downloadPercent = 0;
                this.sizeObtainedEvent.fire(packageSize);

                res.on('data', (data) => {
                    downloadedBytes += data.length;
                    let newPercent = Math.ceil(100 * (downloadedBytes / packageSize));
                    if (newPercent !== downloadPercent) {
                        downloadPercent = newPercent;
                        this.progressEvent.fire(downloadPercent);
                    }
                });

                resolve(this.take(res));
            });
            req.on('error', (err) => reject(`Request error ${err.message || 'NONE'}`));
            req.end();
        });
    }
}
