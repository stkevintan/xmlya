import got, { Got, Options, Response } from 'got';
import assert from 'assert';
import { md5 } from '../lib/utilities';

export type ResBody<T = unknown> = {
    msg: string;
    ret: number;
    data?: T;
};

export type OverrideOptions = Pick<Options, 'headers' | 'prefixUrl' | 'protocol' | 'followRedirect'>;
export interface IClient {
    getRaw<T = unknown, R = {}>(
        url: string,
        params?: Options['searchParams'],
        options?: OverrideOptions
    ): Promise<ResBody<T> & R>;
    get: <T>(url: string, params?: any) => Promise<T>;
    // TODO: add other methods: post , delete
}

/* eslint-disable @typescript-eslint/naming-convention */
const BaseHeaders = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36 Edg/86.0.622.69',
    Referer: 'https://www.ximalaya.com',
    Host: 'www.ximalaya.com',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en,zh-CN;q=0.9,zh;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5,ja;q=0.4',
    'Cache-Control': 'no-cache',
};
/* eslint-enable @typescript-eslint/naming-convention */

export interface IRequestOptions {
    cookie?: string | (() => string);
}

export class Client implements IClient {
    protected readonly client: Got;
    constructor(protected options: IRequestOptions) {
        if (!options.cookie) {
            console.warn(
                'cookie is empty, some account-releated api will be failed, set the environment variable COOKIE to get rid of this warning.'
            );
        }
        this.client = got.extend({
            prefixUrl: 'https://www.ximalaya.com',
            headers: {
                cookie: typeof options.cookie === 'function' ? options.cookie() : options.cookie,
                ...BaseHeaders,
            },
            handlers: [
                async (options, next) => {
                    if (options.prefixUrl === 'https://www.ximalaya.com' && options.url.pathname !== '/revision/time') {
                        options.headers['xm-sign'] = await this.getSign();
                    }
                    return next(options);
                },
            ],
        });
    }

    private async getSign(): Promise<string> {
        const url = 'revision/time';
        const { text } = await this.client(url).json<{ text: string }>();
        return [md5(`himalaya-${text}`), `(${randomInt()})`, text, `(${randomInt()})`, Date.now()].join('');
        function randomInt() {
            return Math.round(Math.random() * 100);
        }
    }

    protected parse<T = unknown, R = {}>(response: Response<string>): ResBody<T> & R {
        assert(response?.body, `response of ${response.url}[${response.method}] doesn't have a body`);
        return JSON.parse(response.body);
    }

    async ['get']<T = unknown>(url: string, params?: Options['searchParams'], options?: OverrideOptions): Promise<T> {
        const body = await this.getRaw<T>(url, params, options);
        assert(body.ret === 200, `response of ${url}[GET] failed, msg: ${body.msg}`);
        return body.data!;
    }

    async getRaw<T = unknown, R = {}>(
        url: string,
        params?: Options['searchParams'],
        options?: OverrideOptions
    ): Promise<ResBody<T> & R> {
        try {
            const res = await this.client(url, { searchParams: params, ...options });
            return this.parse<T, R>(res);
        } catch (e) {
            // re-pack the error
            Error.captureStackTrace(e);
            if (e.response?.body) {
                e.message += ` (body: ${e.response.body})`;
            }

            throw e;
        }
    }
}

