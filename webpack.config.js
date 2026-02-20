'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  name: 'extension',
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
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
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log'
  }
};

/** @type {import('webpack').Configuration} */
const rendererConfig = {
  name: 'renderer',
  target: 'web',
  mode: 'none',
  entry: './src/renderer/index.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
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

module.exports = [extensionConfig, rendererConfig];
