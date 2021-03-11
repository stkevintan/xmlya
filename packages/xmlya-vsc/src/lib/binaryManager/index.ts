import { BinaryProvider } from './binary-provider';
import { OsxBinaryProvider } from './osx-binary-provider';

export type { BinaryProvider } from './binary-provider';

export const findMatchedBinaryProvider = (root: string): BinaryProvider | undefined =>
    [OsxBinaryProvider].map((P) => new P(root)).find((p) => p.isMatch());
