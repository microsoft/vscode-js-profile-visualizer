const path = require('path');
const production = process.argv.includes('production');

module.exports = (dirname, target) => ({
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'source-map',
  entry: './src/extension.ts',
  target,
  output: {
    path: path.join(dirname, 'out'),
    filename: target === 'webworker' ? 'extension.web.js' : 'extension.js',
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: (target === 'webworker' ? ['.web.js'] : []).concat(['.ts', '.js', '.json']),
    conditionNames: ['bundler', 'module', 'require'],
    ...(target === 'node'
      ? {}
      : {
          fallback: {
            path: require.resolve('path-browserify'),
            os: require.resolve('os-browserify/browser'),
          },
        }),
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
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
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
  experiments: {
    syncWebAssembly: true,
  },
});
