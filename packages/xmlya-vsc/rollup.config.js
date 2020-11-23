import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'src/extension.ts',
    external: ['typescript', 'vscode', 'micromatch'],
    output: {
        file: 'dist/extension.js',
        format: 'cjs',
        sourcemap: true,
    },
    preserveSymlinks: true,
    plugins: [
        typescript(),
        nodeResolve({
            browser: false,
            customResolveOptions: {
                moduleDirectory: ['node_modules'],
            },
            preferBuiltins: true,
        }),
        commonjs({
            include: /node_modules/,
        }),
    ],
};
