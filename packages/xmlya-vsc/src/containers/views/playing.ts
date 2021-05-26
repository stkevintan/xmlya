import { Mpv } from '@xmlya/mpv';
import { ContextService } from 'src/context';
import { Uri, Event, Webview, WebviewView, WebviewViewProvider, EventEmitter, Disposable } from 'vscode';
import { debounce } from 'throttle-debounce-ts';
interface IPlayerState {
    total: number;
    album: string;
    title: string;
    cover: string;
    playing: boolean;
}
export class PlayingWebviewProvider implements WebviewViewProvider {
    private readonly root: Uri;
    constructor(private mpv: Mpv, private readonly context: ContextService) {
        this.root = this.context.extensionUri;
    }

    private _onDidWebviewRefresh: EventEmitter<void> = new EventEmitter<void>();

    private onPosSync = new EventEmitter<void>();

    readonly onDidWebviewRefresh: Event<void> = this._onDidWebviewRefresh.event;

    refresh() {
        this._onDidWebviewRefresh.fire();
    }

    private diffChanges(keys: string[]): null | { type: string; payload?: any } {
        const changes: Partial<IPlayerState> = {};
        let changed = false;
        if (keys.includes('player.readyState')) {
            const state = this.context.get('player.readyState');
            switch (state) {
                case 'playing':
                    changes.playing = true;
                    changed = true;
                    break;
                case 'loading':
                case 'seeking':
                case 'paused':
                    changes.playing = false;
                    changed = true;
                    break;
                case 'error':
                case 'idle':
                case 'resolving':
                    return { type: 'clearState' };
            }
        }

        if (keys.includes('player.trackTitle')) {
            changes.title = this.context.get<string>('player.trackTitle');
            changed = true;
        }
        if (keys.includes('player.trackAlbum')) {
            changes.album = this.context.get<string>('player.trackAlbum');
            changed = true;
        }
        if (keys.includes('player.trackDuration')) {
            changes.total = this.context.get<number>('player.trackDuration');
            // this.onPosSync.fire();
            changed = true;
        }
        if (keys.includes('player.trackCover')) {
            changes.cover = this.context.get<string>('player.trackCover');
            changed = true;
        }

        if (changed) {
            return { type: 'updateState', payload: changes };
        }
        return null;
    }

    private async getCurrentPos(): Promise<number> {
        const pos = Math.ceil(await this.mpv.getTimePos());
        return Number.isNaN(pos) ? 0 : pos;
    }

    resolveWebviewView(
        webviewView: WebviewView
        // context: WebviewViewResolveContext<unknown>,
        // token: CancellationToken
    ): void | Thenable<void> {
        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);
        const handles: Disposable[] = [];
        handles.push(
            this._onDidWebviewRefresh.event(() => (webviewView.webview.html = this.getHtml(webviewView.webview)))
        );

        webviewView.onDidDispose(
            () => {
                Disposable.from(...handles).dispose();
            },
            null,
            this.context.subscriptions
        );

        handles.push(
            webviewView.webview.onDidReceiveMessage((e) => {
                if (!e || !e.type) return;
                const readyState = this.context.get<string>('player.readyState')!;
                switch (e.type) {
                    case 'watch-state':
                        if (['playing', 'seeking', 'loading', 'paused'].includes(readyState))
                            void webviewView.webview.postMessage({
                                type: 'setState',
                                payload: <IPlayerState>{
                                    playing: readyState === 'playing',
                                    title: this.context.get<string>('player.trackTitle'),
                                    album: this.context.get<string>('player.trackAlbum'),
                                    total: this.context.get<number>('player.trackDuration'),
                                    cover: this.context.get<string>('player.trackCover'),
                                },
                            });
                        handles.push(
                            this.onPosSync.event(async () => {
                                await webviewView.webview.postMessage({
                                    type: 'setPosition',
                                    payload: await this.getCurrentPos(),
                                });
                            })
                        );
                        handles.push(
                            this.context.onChange((keys) => {
                                const message = this.diffChanges(keys);
                                if (message) {
                                    void webviewView.webview.postMessage(message);
                                }
                            })
                        );
                        break;
                    case 'sync-pos':
                        this.deboucedFirePosSync();
                        break;
                    case 'update-progress':
                        const { value } = e.payload;
                        if (['playing', 'paused'].includes(readyState)) {
                            void this.mpv.seek(value, 'absolute').then(() => this.onPosSync.fire());
                        }
                }
            })
        );
    }
    private deboucedFirePosSync = debounce(1000, () => this.onPosSync.fire());

    private getHtml(webview: Webview): string {
        const styleResourceUri = webview.asWebviewUri(Uri.joinPath(this.root, 'player', 'index.css'));

        const scriptResourceUri = webview.asWebviewUri(Uri.joinPath(this.root, 'player', 'index.js'));

        const renderTime = Date.now();
        return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>App</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script defer src="${scriptResourceUri}?at=${renderTime}"></script>
    <link href="${styleResourceUri}?at=${renderTime}" rel="stylesheet">
  </head>
  <body>
  </body>
</html>`;
    }
}
