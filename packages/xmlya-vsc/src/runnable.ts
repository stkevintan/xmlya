import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/naming-convention
const CommandSym = Symbol('command');

export const command = (name: string) => (target: Runnable, propertyKey: string) => {
    let commands = Reflect.getMetadata(CommandSym, target);
    const entry = { name, propertyKey };
    if (commands) {
        commands.push(entry);
    } else {
        commands = [entry];
    }
    Reflect.defineMetadata(CommandSym, commands, target);
};
const noop = () => { };

export class Runnable extends vscode.Disposable {
    constructor(callOnDispose = noop) {
        super(callOnDispose);
    }

    runInContext(context: vscode.ExtensionContext) {
        const commands = Reflect.getMetadata(CommandSym, this) as { name: string; propertyKey: string }[];
        commands?.map((command) =>
            context.subscriptions.push(
                vscode.commands.registerCommand(`xmlya.${command.name}`, (this as any)[command.propertyKey].bind(this))
            )
        );
    }
}
