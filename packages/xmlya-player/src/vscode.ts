let cache: any = null;

export function getVscode() {
    if (cache) return cache;
    return (cache = (window as any).acquireVsCodeApi());
}
