const path = require('path');
const production = process.argv.includes('production');

module.exports = dirname => ({
  mode: production ? 'production' : 'development',
  target: 'node',
  devtool: production ? false : 'source-map',
  entry: './src/extension.ts',
  output: {
    path: path.join(dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
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
