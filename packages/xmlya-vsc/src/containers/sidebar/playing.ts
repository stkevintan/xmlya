import { Mpv } from '@xmlya/mpv';
import { ContextService } from 'src/context';
import { asyncInterval } from 'src/lib';
import {
    CancellationToken,
    Uri,
    Event,
    Webview,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    EventEmitter,
    Disposable,
} from 'vscode';
interface IPlayerState {
    currentPos: number;
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

    readonly onDidWebviewRefresh: Event<void> = this._onDidWebviewRefresh.event;

    refresh() {
        this._onDidWebviewRefresh.fire();
    }

    resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext<unknown>,
        token: CancellationToken
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
            this.context.onChange((keys) => {
                const changes: Partial<IPlayerState> = {};
                if (keys.includes('player.readyState')) {
                    switch (this.context.get('player.readyState')) {
                        case 'playing':
                            changes.playing = true;
                            break;
                        case 'seeking':
                        case 'loading':
                        case 'paused':
                            changes.playing = false;
                            break;
                        default:
                            void webviewView.webview.postMessage({ type: 'clear' });
                    }
                }

                if (keys.includes('player.trackTitle')) {
                    changes.title = this.context.get<string>('player.trackTitle');
                }
                if (keys.includes('player.trackAlbum')) {
                    changes.album = this.context.get<string>('player.trackAlbum');
                }
                if (keys.includes('player.trackDuration')) {
                    changes.total = this.context.get<number>('player.trackDuration');
                }
                if (keys.includes('player.trackCover')) {
                    changes.cover = this.context.get<string>('player.trackCover');
                }

                if (Object.keys(changes).length > 0) {
                    void webviewView.webview.postMessage({ type: 'setState', payload: changes });
                }
            })
        );

        handles.push(
            webviewView.webview.onDidReceiveMessage((e) => {
                if (!e || !e.type) return;
                const readyState = this.context.get<string>('player.readyState')!;
                switch (e.type) {
                    case 'pollState':
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
                        break;
                    case 'update-progress':
                        const { value } = e.payload;
                        if (['playing', 'paused'].includes(readyState)) {
                            void this.mpv.seek(value, 'absolute');
                        }
                }
            })
        );
        handles.push(
            asyncInterval(async () => {
                if (this.context.get<string>('player.readyState') !== 'playing') return;
                const cur = Math.ceil(await this.mpv.getTimePos());
                void webviewView.webview.postMessage({
                    type: 'setState',
                    payload: <Partial<IPlayerState>>{
                        currentPos: isNaN(cur) ? 0 : cur,
                    },
                });
            }, 1000)
        );
    }

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
