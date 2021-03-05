import { BinaryProvider } from './binaryProvider';
import { OsxBinaryProvider } from './osxBinaryProvider';

export type { BinaryProvider } from './binaryProvider';

export const findMatchedBinaryProvider = (root: string): BinaryProvider | undefined =>
    [OsxBinaryProvider].map((P) => new P(root)).find((p) => p.isMatch());
