/**
 * {"ret":200,"data":{"trackId":248577194,"canPlay":true,"isPaid":true,"hasBuy":true,"src":null,"albumIsSample":false,"sampleDuration":180,"isBaiduMusic":false,"firstPlayStatus":true,"isVipFree":false,"isXimiAhead":false,"isAlbumTimeLimited":false}}
 */

export interface GetTrackAudioResult {
    trackId: number;
    canPlay: boolean;
    isPaid: boolean;
    hasBuy: boolean;
    src?: string | null;
    albumIsSample: boolean;
    sampleDuration: number;
    isBaiduMusic: boolean;
    firstPlayStatus: boolean;
    isVipFree: boolean;
    isXimiAhead: boolean;
    isAlbumTimeLimited: boolean;
}
