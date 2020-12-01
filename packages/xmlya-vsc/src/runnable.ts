import 'reflect-metadata';
import * as vscode from 'vscode';
import { Func, isPromise, PromiseOrNot } from './lib';
import { Logger } from './lib/logger';

// eslint-disable-next-line @typescript-eslint/naming-convention
const CommandSym = Symbol('command');
const DescSym = Symbol('desc');

type MethodPropertyKeys<T> = { [K in keyof T]: T[K] extends Func<any[], any> ? K : never }[keyof T];

export const command = (name: string, desc?: string) => <T extends Runnable, F extends Func<any[], PromiseOrNot<void>>>(
    target: T,
    propertyKey: MethodPropertyKeys<T>,
    descriptor: TypedPropertyDescriptor<F>
): TypedPropertyDescriptor<F> => {
    // register command and propertyKey.
    let commands = Reflect.getMetadata(CommandSym, target);
    const entry = { name, propertyKey };
    if (commands) {
        commands.push(entry);
    } else {
        commands = [entry];
    }
    Reflect.defineMetadata(CommandSym, commands, target);

    if (desc) {
        Reflect.defineMetadata(DescSym, desc, target, propertyKey as string);
    }
    // proxy the error handler
    const method = target[propertyKey];
    Logger.assertTrue(typeof method === 'function', `Property of ${propertyKey} is not a method.`);

    const boundMethod = Symbol(`proxied/${propertyKey}`);

    const handler = Logger.throw;

    return {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get(this: { [boundMethod]: any } & T) {
            if (this[boundMethod] === undefined) {
                this[boundMethod] = (...args: any[]) => {
                    try {
                        const ret = (method as any).call(this, ...args);
                        if (isPromise(ret)) {
                            ret.catch(handler);
                        }
                        return ret;
                    } catch (err) {
                        handler(err);
                    }
                };
            }
            return this[boundMethod];
        },
        set(value: F) {
            Object.defineProperty(this, propertyKey, {
                enumerable: true,
                writable: true,
                configurable: true,
                value,
            });
        },
    };
};

export class Runnable extends vscode.Disposable {
    private locked = false;
    private release?: () => void;

    private lock(title: string) {
        if (this.locked) return;
        this.locked = true;
        vscode.window.withProgress(
            {
                title,
                location: vscode.ProgressLocation.Notification,
            },
            () =>
                new Promise<void>(
                    (res) =>
                        (this.release = () => {
                            this.locked = false;
                            this.release = undefined;
                            res();
                        })
                )
        );
    }

    get isLocked() {
        return this.locked;
    }

    constructor(callOnDispose: () => void) {
        super(callOnDispose);
    }

    runInContext(context: vscode.ExtensionContext) {
        const commands = Reflect.getMetadata(CommandSym, this) as { name: string; propertyKey: string }[];
        if (!commands) return;
        for (const command of commands) {
            const title = Reflect.getMetadata(DescSym, this, command.propertyKey);
            context.subscriptions.push(
                vscode.commands.registerCommand(`xmlya.${command.name}`, async (...args: any[]) => {
                    // TODO: add debounce if necessary.
                    if (title && this.locked) return;
                    try {
                        this.lock(title);
                        await (this as any)[command.propertyKey](...args);
                    } finally {
                        this.release?.();
                    }
                })
            );
        }
    }
}
