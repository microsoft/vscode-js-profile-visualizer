const path = require('path');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const target = process.env.TARGET;
const standalone = process.env.STANDALONE === '1';
const production = process.env.MODE === 'production';

const constants = {};
if (standalone) {
  const constantPrefix = 'VIZ_';
  for (const key of Object.keys(process.env).filter(k => k.startsWith(constantPrefix))) {
    const value = process.env[key];
    const name = key.slice(constantPrefix.length);
    try {
      constants[name] = JSON.parse(fs.readFileSync(value, 'utf-8'));
    } catch {
      constants[name] = JSON.parse(value);
    }
  }
}

module.exports = {
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'inline-source-map',
  entry: `./src/${target}/client.tsx`,
  output: {
    path: path.join(__dirname, 'out'),
    filename: `${target}.js`,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json', '.svg', '.vert', '.frag'],
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
      {
        test: /\.(vert|frag)$/,
        loader: 'raw-loader',
      },
    ],
  },
  plugins: standalone
    ? [new HtmlWebpackPlugin({ template: 'samples/index.ejs', templateParameters: { constants } })]
    : [],
};
