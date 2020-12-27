import { ContextService } from 'src/context';
import { PromiseOrNot } from 'src/lib';
import { Runnable } from 'src/runnable';
import {
    window,
    Disposable,
    WebviewViewProvider,
    CancellationToken,
    WebviewView,
    WebviewViewResolveContext,
} from 'vscode';

export class Sidebar extends Runnable {
    initialize(context: ContextService): PromiseOrNot<Disposable | undefined> {
        window.registerWebviewViewProvider('xmlya-view', new XmlyaWebviewProvider());
        return undefined;
    }
}

export class XmlyaWebviewProvider implements WebviewViewProvider {
    resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext<unknown>,
        token: CancellationToken
    ): void | Thenable<void> {
        throw new Error('Method not implemented.');
    }
}
