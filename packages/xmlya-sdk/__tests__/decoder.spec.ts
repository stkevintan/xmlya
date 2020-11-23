import { XmlyaSDK } from '../src';
import { decodeNonFreeAudioSrc, getFileName, getFileParams } from '../src/lib/decoder';
import { Client } from '../src/sdk/client';
describe('test decoder functions', () => {
    let sdk: XmlyaSDK;
    beforeAll(async () => {
        const cookie = process.env.COOKIE;
        const client = new Client({ cookie });
        sdk = new XmlyaSDK(client);
    });

    it('should getFileName work', async () => {
        const fd = 'xS2cN5nANk1LzVBVrHm9Ak0XYSqKzfvjq2C2RRAHd4sVF4Fo0easg/iJL5VmUIDlFKyQ0BDatTs6GyrWGOqptw==';
        expect(await getFileName(fd)).toBe('group1/M0B/52/F9/wKgJN1s8vPHy3Y4pADrtYzboeeg806.m4a');
    });

    it('should getFileParams work', async () => {
        const ep = 'KldXgxSVTEEAt6/ZJYDxXOuOorvOaAeNtlo6CiKuvjpwbhKXlVRGvRJGKSbC0a7V8J3jQbP6+r23h0mnxUp3quW9nQ==';
        expect(await getFileParams(ep)).toEqual({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            buy_key: '373638383934383130',
            sign: '9e701484fa24e83623c43ff530f29956',
            token: '7328',
            timestamp: '1606117604',
        });
    });

    it('should decoder work', async () => {
        const trackId = 96909420;
        const ret = await sdk.getTrackAudio({ trackId });
        expect(ret.src).toBe(null);
        const ret2 = await sdk.getNonFreeTrackAudio({ trackId });
        expect(await decodeNonFreeAudioSrc(ret2)).toContain(
            'https://audiopay.cos.tx.xmcdn.com/download/1.0.0/group1/M02/52/93/wKgJMls7azLyPCJ4ADrJc35LFT4561.m4a'
        );
    });
});
