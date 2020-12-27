/* eslint-disable @typescript-eslint/naming-convention */
import loader from '@assemblyscript/loader';
import got from 'got';
import { URLSearchParams } from 'url';
import { GetNonFreeTrackAudioResult } from '../types';
import { lazy } from './utilities';

export interface IFileParams {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    buy_key: string;
    sign: string;
    token: string;
    timestamp: string;
}

const wasm$ = lazy(async () => {
    const buffer = got('https://github.com/stkevintan/xmlya/releases/download/1.0.0/native.wasm', {
        responseType: 'buffer',
        resolveBodyOnly: true,
    });
    // nodejs don't support instatiateStreaming
    const wasm = await loader.instantiate(buffer);
    const { __getString, __allocString, __retain, __release } = wasm.exports;
    const { getFileName, getFileParams } = wasm.exports as Record<string, (...args: number[]) => number>;
    return [
        wasm,
        {
            getFileName: (fd: string): string => {
                const fdPtr = __retain(__allocString(fd));
                const retPtr = getFileName(fdPtr);
                const ret = __getString(retPtr);
                __release(fdPtr);
                __release(retPtr);
                return ret;
            },
            getFileParams: (ep: string): any => {
                const epPtr = __retain(__allocString(ep));
                const retPtr = getFileParams(epPtr);
                const ret = __getString(retPtr);
                __release(epPtr);
                __release(retPtr);
                return ret;
            },
        },
    ] as const;
});

export async function decodeNonFreeAudioSrc(audio: GetNonFreeTrackAudioResult): Promise<string> {
    const { fileId, ep, duration, domain, apiVersion } = audio;
    const host = domain;
    const fileName = await getFileName(fileId);
    const fileParams = await getFileParams(ep);
    const searchParams = new URLSearchParams({
        buy_key: fileParams.buy_key,
        sign: fileParams.sign,
        token: fileParams.token,
        timestamp: fileParams.timestamp,
        duration: `${duration}`,
    });
    return `${host.replace(/^http:/, 'https:')}/download/${apiVersion}/${fileName}?${searchParams}`;
}

export async function getFileName(fileId: string): Promise<string> {
    const [, funcs] = await wasm$();
    return funcs.getFileName(fileId).replace(/[^\w\d\-/.]+$/g, '');
}

export async function getFileParams(ep: string): Promise<IFileParams> {
    const [, funcs] = await wasm$();
    const [buy_key, sign, token, timestamp] = funcs.getFileParams(ep).split('-');
    return {
        buy_key,
        sign,
        token,
        timestamp,
    };
}
