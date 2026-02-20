'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const kernelConfig = {
  name: 'kernel',
  target: 'node',
  mode: 'none',
  entry: './src/kernelExtension.ts',
  output: {
    path: path.resolve(__dirname, 'kernel-only/out'),
    filename: 'kernelExtension.js',
    libraryTarget: 'commonjs2'
  },
  externals: [
    { vscode: 'commonjs vscode' },
    /^mssql/,
    /^tedious/,
    /^@azure\//,
    /^tarn/,
    /^generic-pool/
  ],
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules|src[\\/]renderer/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map'
};

/** @type {import('webpack').Configuration} */
const rendererConfig = {
  name: 'renderer',
  target: 'web',
  mode: 'none',
  entry: './src/renderer/index.ts',
  output: {
    path: path.resolve(__dirname, 'kernel-only/out'),
    filename: 'renderer.js',
    libraryTarget: 'module'
  },
  experiments: {
    outputModule: true
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.renderer.json'
            }
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map'
};

module.exports = [kernelConfig, rendererConfig];
