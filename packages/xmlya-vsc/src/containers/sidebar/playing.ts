import { CancellationToken, Webview, WebviewView, WebviewViewProvider, WebviewViewResolveContext } from 'vscode';

export class PlayingWebviewProvider implements WebviewViewProvider {
    resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext<unknown>,
        token: CancellationToken
    ): void | Thenable<void> {
        webviewView.webview.options = {
            enableScripts: true,
            // localResourceRoots:
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((e) => {
            console.log('webview receive:', e);
        });
    }

    private getHtml(webview: Webview): string {
        return `<!DOCTYPE html>
			<html lang="en">
            <body>
            <div>hello world</div>
            </body>
            </html>`;
    }
}
