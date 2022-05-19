const path = require('path');
const production = process.argv.includes('production');
const node = process.argv.includes('node');

module.exports = (dirname, file = 'client') => ({
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'inline-source-map',
  entry: `./src/client/client.tsx`,
  output: {
    path: path.join(dirname, 'out'),
    filename: `${file}.bundle.js`,
    publicPath: 'http://localhost:8116/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.svg', '.vert', '.frag'],
    ...(node
      ? {}
      : {
          fallback: {
            path: require.resolve('path-browserify'),
            os: require.resolve('os-browserify/browser'),
          },
        }),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: { configFile: 'tsconfig.browser.json' },
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: true,
            },
          },
          'postcss-loader',
        ],
      },
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader',
      },
      {
        test: /\.(vert|frag)$/,
        loader: 'raw-loader',
      },
    ],
  },
  devServer: {
    allowedHosts: ['null'],
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
