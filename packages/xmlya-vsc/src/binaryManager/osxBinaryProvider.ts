import { IncomingMessage } from 'http';
import { BinaryProvider } from './binaryProvider';
import { promisify } from 'util';
import { pipeline } from 'stream';
import gunzip from 'gunzip-maybe';
import path from 'path';
import * as tar from 'tar';

const pipe = promisify(pipeline);
export class OsxBinaryProvider extends BinaryProvider {
    protected packageUrl: string = 'https://laboratory.stolendata.net/~djinn/mpv_osx/mpv-latest.tar.gz';
    async take(res: IncomingMessage): Promise<void> {
        await pipe(res, gunzip(), tar.x({ strip: 1, C: this.directory }));
    }

    get binaryPath(): string {
        return path.join(this.directory, 'Contents/MacOS/mpv');
    }

    isMatch() {
        return process.platform === 'darwin';
    }
}
