import { SortOrder, XmlyaSDK } from '../src';
import { Client } from '../src/sdk/client';

describe('test sdk methods', () => {
    let sdk: XmlyaSDK;
    beforeAll(async () => {
        const cookie = process.env.COOKIE;
        const client = new Client({ cookie });
        sdk = new XmlyaSDK(client);
    });
    it('should getCurrentUser work', async () => {
        const result = await sdk.getCurrentUser();
        expect(result.uid).toBeGreaterThan(0);
    });

    it('should listen history work', async () => {
        const ret = await sdk.getPlayHistory();
        expect(ret.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should subscriptions work', async () => {
        const ret = await sdk.getSubscriptions();
        expect(ret.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should favorites work', async () => {
        const ret = await sdk.getFavorites();
        expect(ret.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should purchased albums work', async () => {
        const ret = await sdk.getPurchasedAlbums();
        expect(ret.totalCount).toBeGreaterThanOrEqual(0);
    });

    it('should album with tracks work', async () => {
        const albumId = 43859170;
        const ret = await sdk.getAlbumWithTracks({ albumId });
        expect(ret.mainInfo.albumTitle).toBe('老舍小说《牛天赐传》');
        expect(ret.anchorInfo.anchorId).toBe(241801279);
        expect(ret.tracksInfo.totalCount).toBeGreaterThan(10);
        expect(ret.tracksInfo.tracks.length).toBeGreaterThan(0);
    });

    it('should tracks of album work', async () => {
        const albumId = 43859170;
        const ret = await sdk.getTracksOfAlbum({ sort: SortOrder.desc, albumId });
        expect(ret.totalCount).toBeGreaterThan(10);
        expect(ret.tracks.length).toBeGreaterThan(0);
        const first = ret.tracks[0];
        const last = ret.tracks[ret.tracks.length - 1];
        expect(first.index).toBeGreaterThan(last.index);
    });

    it('should comments of track work', async () => {
        const trackId = 18556415;
        const ret = await sdk.getCommentsOfTrack({ trackId });
        expect(ret.pageNum).toBe(1);
        expect(ret.totalCount).toBeGreaterThan(30989);
        expect(ret.comments[0]?.id).toBeTruthy();
    });

    it('should get track audio work', async () => {
        const trackId = 18556415;
        const ret = await sdk.getTrackAudio({ trackId });
        expect(ret.canPlay).toBeTruthy();
        expect(ret.trackId).toBe(trackId);
        expect(ret.src).toBeTruthy();
    });

    it('should get non-free track audio work', async () => {
        const trackId = 96909420;
        const ret = await sdk.getTrackAudio({ trackId });
        expect(ret.canPlay).toBe(true);
        expect(ret.src).toBe(null);
        const ret2 = await sdk.getNonFreeTrackAudio({ trackId });
        expect(ret2.trackId).toBe(trackId);
        expect(ret2.ep).toBeTruthy();
    });

    it('should get context tracks work', async () => {
        const trackId = 18556415;
        const ret = await sdk.getContextTracks({ trackId, size: 2 });
        expect(ret.hasMore).toBe(true);
        expect(ret.tracksAudioPlay.length).toBe(2);
    });

    it('should server time work', async () => {
        const ret = await sdk.getServerTime();
        expect(ret).toBeTruthy();
    });

    it('should token get success', async () => {
        const ret = await sdk.getTraceToken({ trackId: 97098327 });
        expect(ret.token).toBeTruthy();
    });

    it('should interval get success', async () => {
        const ret = await sdk.getTraceInterval();
        expect(ret.interval).toBeTruthy();
    });

    it('should track work', async () => {
        const trackId = 97098327;
        const ret = await sdk.traceStats({
            trackId,
            albumId: 14356532,
            startedAt: Date.now() - 20 * 1000,
            breakSecond: 15,
            token: (await sdk.getTraceToken({ trackId })).token,
        });
        expect(ret).toBeFalsy();
    });
});
