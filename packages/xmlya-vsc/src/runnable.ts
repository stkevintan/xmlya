import { XmlyaSDK } from '@xmlya/sdk';
import 'reflect-metadata';
import * as vscode from 'vscode';
import { ContextService } from './context';
import { Func, isPromise, PromiseOrNot } from './lib';
import { Logger, Notification } from './lib/logger';

// eslint-disable-next-line @typescript-eslint/naming-convention
const CommandSym = Symbol('command');
const DescSym = Symbol('desc');

type MethodPropertyKeys<T> = { [K in keyof T]: T[K] extends Func<any[], any> ? K : never }[keyof T];

export const command = (name: string, desc?: string | boolean) => <
    T extends Runnable,
    F extends Func<any[], PromiseOrNot<void>>
>(
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
        Reflect.defineMetadata(DescSym, desc, target, typeof propertyKey !== 'string' ? '' : propertyKey);
    }
    // proxy the error handler
    const method = target[propertyKey];
    Notification.assertTrue(typeof method === 'function', `Property of ${propertyKey} is not a method.`);

    const boundMethod = Symbol(`proxied/${propertyKey}`);

    const handler = (err: any) => Notification.throw(err);

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

export abstract class Runnable {
    private locked = false;
    private release?: () => void;
    private subs: vscode.Disposable[] = [];
    private lock(title: string) {
        if (this.locked) return;
        this.locked = true;
        if (title) {
            void vscode.window.withProgress(
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
        } else {
            this.release = () => {
                this.locked = false;
                this.release = undefined;
            };
        }
    }

    get isLocked() {
        return this.locked;
    }

    constructor(protected sdk: XmlyaSDK, protected context: ContextService) {}

    protected register<T extends vscode.Disposable>(x: T): T {
        this.subs.push(x);
        return x;
    }

    run() {
        this.context.subscriptions.push({
            dispose: () => {
                vscode.Disposable.from(...this.subs).dispose();
            },
        });
        const commands = Reflect.getMetadata(CommandSym, this) as { name: string; propertyKey: string }[];
        if (!commands) return;
        for (const command of commands) {
            const title = Reflect.getMetadata(DescSym, this, command.propertyKey);
            this.context.subscriptions.push(
                vscode.commands.registerCommand(`xmlya.${command.name}`, (...args: any[]) => {
                    // TODO: add debounce if necessary.
                    if (title != null && this.locked) return;
                    try {
                        if (title != null) {
                            this.lock(title);
                        }
                        const ret = (this as any)[command.propertyKey](...args);
                        if (isPromise(ret)) {
                            return ret.catch(() => this.release?.());
                        }
                        return ret;
                    } catch (e) {
                        Logger.Channel?.appendLine(`Failed to execute command xmlya.${command.name}: ${e}`);
                        throw e;
                    } finally {
                        this.release?.();
                    }
                })
            );
        }
    }
}
