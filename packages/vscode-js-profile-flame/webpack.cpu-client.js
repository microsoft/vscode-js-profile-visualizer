module.exports = {
  ...require('../../scripts/webpack.client')(__dirname, 'cpu-client'),
  entry: `./src/client/cpu/client.tsx`,
};
