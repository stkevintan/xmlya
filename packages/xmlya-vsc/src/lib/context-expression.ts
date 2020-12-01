/**
 * A simple implement of  `vscode.contextKey`
 */

export type ContextExpression =
    | ContextFalseExpr
    | ContextTrueExpr
    | ContextKeyExpr
    | ContextEqualsExpr
    | ContextNotEqualsExpr
    | ContextKeyNotExpr
    | ContextAndExpr
    | ContextOrExpr;

export interface IContext {
    get<T>(key: string): T | undefined;
}

interface IContextExpression {
    keys(): string[];
    negate(): ContextExpression;
    serialize(): string;
    evaluate(context: IContext): boolean;
}

export class ContextFalseExpr implements IContextExpression {
    static INSTANCE = new ContextFalseExpr();

    protected constructor() {}

    keys(): string[] {
        return [];
    }
    serialize(): string {
        return 'false';
    }
    evaluate(context: IContext): boolean {
        return false;
    }
    negate(): ContextExpression {
        return ContextTrueExpr.INSTANCE;
    }
}

export class ContextTrueExpr implements IContextExpression {
    static INSTANCE = new ContextTrueExpr();

    protected constructor() {}

    keys(): string[] {
        return [];
    }
    serialize(): string {
        return 'true';
    }
    evaluate(context: IContext): boolean {
        return true;
    }
    negate(): ContextExpression {
        return ContextFalseExpr.INSTANCE;
    }
}

export class ContextKeyExpr implements IContextExpression {
    static create(key: string): ContextExpression {
        return new ContextKeyExpr(key);
    }

    protected constructor(protected readonly key: string) {}

    keys(): string[] {
        return [this.key];
    }

    serialize(): string {
        return this.key;
    }

    evaluate(context: IContext): boolean {
        return !!context.get(this.key);
    }

    negate(): ContextExpression {
        throw new Error('Method not implemented.');
    }
}

export class ContextEqualsExpr implements IContextExpression {
    static create(key: string, value: any): ContextExpression {
        if (typeof value === 'boolean') {
            return value ? ContextKeyExpr.create(key) : ContextKeyNotExpr.create(key);
        }
        return new ContextEqualsExpr(key, value);
    }

    protected constructor(protected readonly key: string, protected readonly value: any) {}

    keys(): string[] {
        return [this.key];
    }

    serialize(): string {
        return `${this.key} == ${this.value}`;
    }

    evaluate(context: IContext): boolean {
        // eslint-disable-next-line eqeqeq
        return context.get(this.key) == this.value;
    }

    negate(): ContextExpression {
        return ContextNotEqualsExpr.create(this.key, this.value);
    }
}

export class ContextNotEqualsExpr implements IContextExpression {
    static create(key: string, value: any): ContextExpression {
        if (typeof value === 'boolean') {
            return value ? ContextKeyNotExpr.create(key) : ContextKeyExpr.create(key);
        }
        return new ContextNotEqualsExpr(key, value);
    }

    protected constructor(protected readonly key: string, protected readonly value: any) {}

    keys(): string[] {
        return [this.key];
    }

    serialize(): string {
        return `${this.key} != ${this.value}`;
    }

    evaluate(context: IContext): boolean {
        // eslint-disable-next-line eqeqeq
        return context.get(this.key) != this.value;
    }

    negate(): ContextExpression {
        return ContextEqualsExpr.create(this.key, this.value);
    }
}

export class ContextKeyNotExpr implements IContextExpression {
    static create(key: string): ContextExpression {
        return new ContextKeyNotExpr(key);
    }

    protected constructor(protected readonly key: string) {}

    keys(): string[] {
        return [this.key];
    }

    serialize(): string {
        return `!${this.key}`;
    }

    evaluate(context: IContext): boolean {
        return !context.get(this.key);
    }

    negate(): ContextExpression {
        return ContextKeyExpr.create(this.key);
    }
}

export class ContextAndExpr implements IContextExpression {
    static create(exprs: ReadonlyArray<ContextExpression | null | undefined>): ContextExpression | undefined {
        const _exprs = ContextAndExpr._normalizeArray(exprs);
        if (_exprs.length === 0) {
            return undefined;
        }

        if (_exprs.length === 1) {
            return _exprs[0];
        }

        return new ContextAndExpr(_exprs);
    }

    protected constructor(public readonly exprs: ContextExpression[]) {}

    private static _normalizeArray(arr: ReadonlyArray<ContextExpression | null | undefined>): ContextExpression[] {
        const exprs: ContextExpression[] = [];
        let hasTrue = false;
        for (const expr of arr) {
            if (!expr) continue;

            if (expr instanceof ContextTrueExpr) {
                hasTrue = true;
                continue;
            }

            if (expr instanceof ContextFalseExpr) {
                // anything && false ===> false
                return [ContextFalseExpr.INSTANCE];
            }

            if (expr instanceof ContextAndExpr) {
                exprs.push(...expr.exprs);
                continue;
            }

            if (expr instanceof ContextOrExpr) {
                // need distribute OR expressions, see: https://github.com/microsoft/vscode/issues/101015
                throw new Error('Not Supported');
            }
            exprs.push(expr);
        }

        if (exprs.length === 0 && hasTrue) {
            return [ContextTrueExpr.INSTANCE];
        }
        return exprs;
    }

    keys(): string[] {
        const result: string[] = [];
        for (const expr of this.exprs) {
            result.push(...expr.keys());
        }
        return result;
    }

    serialize(): string {
        return this.exprs.map((e) => e.serialize()).join(' && ');
    }

    evaluate(context: IContext): boolean {
        for (const expr of this.exprs) {
            if (!expr.evaluate(context)) {
                return false;
            }
        }
        return true;
    }

    negate(): ContextExpression {
        return ContextOrExpr.create(this.exprs.map((expr) => expr.negate()))!;
    }
}

export class ContextOrExpr implements IContextExpression {
    static create(exprs: ReadonlyArray<ContextExpression | null | undefined>): ContextExpression | undefined {
        const _exprs = this._normalizeArr(exprs);
        if (_exprs.length === 0) {
            return undefined;
        }
        if (_exprs.length === 1) {
            return _exprs[0];
        }

        return new ContextOrExpr(_exprs);
    }

    protected constructor(public readonly exprs: ContextExpression[]) {}

    private static _normalizeArr(arr: ReadonlyArray<ContextExpression | null | undefined>): ContextExpression[] {
        const exprs: ContextExpression[] = [];
        let hasFalse = false;
        for (const expr of arr) {
            if (!expr) continue;

            if (expr instanceof ContextFalseExpr) {
                hasFalse = true;
                continue;
            }

            if (expr instanceof ContextTrueExpr) {
                // anything || true ===> true
                return [ContextTrueExpr.INSTANCE];
            }

            if (expr instanceof ContextOrExpr) {
                exprs.push(...expr.exprs);
                continue;
            }

            exprs.push(expr);
        }

        if (exprs.length === 0 && hasFalse) {
            return [ContextFalseExpr.INSTANCE];
        }

        return exprs;
    }

    keys(): string[] {
        const result: string[] = [];
        for (const expr of this.exprs) {
            result.push(...expr.keys());
        }
        return result;
    }

    serialize(): string {
        return this.exprs.map((expr) => expr.serialize()).join(' || ');
    }

    evaluate(context: IContext): boolean {
        for (const expr of this.exprs) {
            if (expr.evaluate(context)) {
                return true;
            }
        }
        return false;
    }

    negate(): ContextExpression {
        // need distribute the AND expressions.
        throw new Error('Method not implemented');
    }
}

export function parseContextString(str: string | null | undefined): ContextExpression | undefined {
    if (!str) return undefined;

    return parseOrString(str);
}

function parseOrString(str: string): ContextExpression | undefined {
    const pieces = str.split('||');
    return ContextOrExpr.create(pieces.map((p) => parseAndString(p)));
}

function parseAndString(str: string): ContextExpression | undefined {
    const pieces = str.split('&&');
    return ContextAndExpr.create(pieces.map((p) => parseOne(p)));
}

function parseOne(str: string): ContextExpression | undefined {
    if (str.includes('!=')) {
        const pieces = str.split(/\!==?/);
        return ContextNotEqualsExpr.create(pieces[0].trim(), parseValue(pieces[1]));
    }

    if (str.includes('==')) {
        const pieces = str.split(/===?/);
        return ContextEqualsExpr.create(pieces[0].trim(), parseValue(pieces[1]));
    }

    if (/^\s*\![^=]+/.test(str)) {
        return ContextKeyNotExpr.create(str.trim().substr(1));
    }

    return ContextKeyExpr.create(str.trim());
}

function parseValue(value: string): any {
    value = value.trim();
    if (value === 'true') return true;
    if (value === 'false') return false;
    // do not use back reference
    const m = /^'([^']*)'$/.exec(value);
    if (m) {
        return m[1].trim();
    }

    const m2 = /^"([^"]*)"$/.exec(value);
    if (m2) {
        return m2[1].trim();
    }

    return value;
}
