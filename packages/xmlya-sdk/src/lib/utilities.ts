import crypto from 'crypto';


export const lazy = <T>(fn: () => T) => {
    let cache: T | null = null;
    return () => {
        if (cache === null) {
            cache = fn();
        }
        return cache;
    };
};


export function md5(str: string, encoding: crypto.BinaryToTextEncoding = 'hex'): string {
    const md5 = crypto.createHash('md5');
    return md5.update(str).digest(encoding);
}
