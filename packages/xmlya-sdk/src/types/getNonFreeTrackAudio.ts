
export interface GetNonFreeTrackAudioResult {
    ret: number;
    msg: string;
    trackId: number;
    uid: number;
    albumId: number;
    title: string;
    domain: string;
    totalLength: number;
    sampleDuration: number;
    sampleLength: number;
    isAuthorized: boolean;
    apiVersion: string;
    seed: number;
    k1: string;
    k2: string;
    fileId: string;
    buyKey: string;
    duration: number;
    ep: string;
    highestQualityLevel: number;
    downloadQualityLevel: number;
    authorizedType: number;
    volumeGain: number;
  }
  