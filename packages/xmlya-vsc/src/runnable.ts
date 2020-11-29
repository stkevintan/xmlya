import 'reflect-metadata';
import * as vscode from 'vscode';
import { Func, isPromise } from './lib';
import { Logger } from './lib/logger';

// eslint-disable-next-line @typescript-eslint/naming-convention
const CommandSym = Symbol('command');
const DescSym = Symbol('desc');

type MethodPropertyKeys<T> = { [K in keyof T]: T[K] extends Func<any[], any> ? K : never }[keyof T];

export const command = (name: string, desc?: string) => <T extends Runnable, F extends Func<any[], any>>(
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

    const handler = Logger.error;

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

const noop = () => {};

export class Runnable extends vscode.Disposable {
    private _busy = false;
    private resolver?: () => void;
    private progress?: vscode.Progress<{ message?: string; increment?: number }>;

    setBusy(value: boolean, title?: string) {
        this._busy = value;
        if (value && title) {
            if (this.progress) {
                this.progress.report({
                    message: title,
                });
            } else {
                vscode.window.withProgress(
                    {
                        title,
                        location: vscode.ProgressLocation.Notification,
                    },
                    (progress) => {
                        this.progress = progress;
                        return new Promise<void>((res) => {
                            this.resolver = () => {
                                this.progress = undefined;
                                res();
                            };
                        });
                    }
                );
            }
        } else {
            this.resolver?.();
        }
    }

    get busy() {
        return this._busy;
    }

    constructor(callOnDispose: () => void, private busyEnalbed = false) {
        super(callOnDispose);
    }

    runInContext(context: vscode.ExtensionContext) {
        const commands = Reflect.getMetadata(CommandSym, this) as { name: string; propertyKey: string }[];
        commands?.map((command) =>
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    `xmlya.${command.name}`,
                    this.busyEnalbed
                        ? async (...args: any[]) => {
                              if (this.busy) return;
                              this.setBusy(true, Reflect.getMetadata(DescSym, this, command.propertyKey));
                              try {
                                  await (this as any)[command.propertyKey](...args);
                              } finally {
                                  this.setBusy(false);
                              }
                          }
                        : (this as any)[command.propertyKey],
                    this
                )
            )
        );
    }
}
