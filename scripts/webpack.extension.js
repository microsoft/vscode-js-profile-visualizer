const path = require('path');
const production = process.argv.includes('production');
const node = process.argv.includes('node');

module.exports = dirname => ({
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'source-map',
  entry: './src/extension.ts',
  output: {
    hashFunction: "xxhash64",
    path: path.join(dirname, 'out'),
    filename: process.argv.includes('web') ? 'extension.web.js' : 'extension.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    fallback: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify/browser'),
    }
  },
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.json',
          compilerOptions: { declaration: false },
        },
      },
    ],
  },
});
