module.exports = {
  ...require('../../scripts/webpack.client')(__dirname, 'realtime'),
  entry: `./src/realtime/client.ts`,
};
