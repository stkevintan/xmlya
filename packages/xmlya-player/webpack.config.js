// @ts-check
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const preprocess = require('svelte-preprocess');
const CopyPlugin = require('copy-webpack-plugin');

const path = require('path');

const resolver = (p) => path.resolve(__dirname, p);

const isDev = process.env.NODE_ENV === 'development';

module.exports = /** @type {import('webpack').Configuration} */ ({
    devtool: isDev ? 'cheap-module-eval-source-map' : false,
    entry: {
        // panel: resolver('./src/scripts/panel.ts'),
        index: resolver('./src/index.ts'),
    },
    output: {
        path: resolver('../xmlya-vsc/player'),
        filename: '[name].js',
    },
    resolve: {
        alias: {
            svelte: path.dirname(require.resolve('svelte/package.json')),
        },
        extensions: ['.mjs', '.js', '.ts', '.less', '.svelte'],
        mainFields: ['svelte', 'browser', 'module', 'main'],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[name].[id].css',
        }),
        // new HtmlWebpackPlugin({
        //     title: 'Scope Anchors',
        //     chunks: ['panel'],
        //     filename: 'panel.html',
        // }),
        new HtmlWebpackPlugin({
            title: 'App',
            chunks: ['index'],
            filename: 'index.html',
        }),
        // new CopyPlugin({
        //     patterns: [
        //         {
        //             from: './manifest.json',
        //             to: resolver('./dist/manifest.json'),
        //         },
        //         { from: './icons/**/*', to: resolver('./dist'), context: './static' },
        //     ],
        // }),
    ],
    module: {
        rules: [
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                use: [
                    {
                        loader: 'file-loader',
                    },
                ],
            },
            {
                test: /.ts$/,
                use: 'ts-loader',
            },
            {
                test: /\.(le|c)ss$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { url: false } },
                    {
                        loader: 'less-loader',
                    },
                ],
            },
            {
                test: /\.(html|svelte)$/,
                use: [
                    {
                        loader: 'svelte-loader',
                        options: {
                            // @ts-ignore
                            preprocess: preprocess({}),
                            compilerOptions: {
                                dev: isDev,
                            },
                            emitCss: !isDev,
                            hotReload: isDev,
                        },
                    },
                ],
            },
            {
                // required to prevent errors from Svelte on Webpack 5+, omit on Webpack 4
                test: /node_modules\/svelte\/.*\.mjs$/,
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
});
