const path = require('path');

const target = process.env.TARGET;

module.exports = {
  devtool: process.argv.includes('production') ? false : 'source-map',
  entry: `./src/${target}/client.tsx`,
  output: {
    path: path.join(__dirname, 'out'),
    filename: `${target}.js`,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.svg'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: { configFile: 'tsconfig.client.json' },
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
    ],
  },
};
