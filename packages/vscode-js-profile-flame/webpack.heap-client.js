module.exports = {
  ...require('../../scripts/webpack.client')(__dirname, 'heap-client'),
  entry: `./src/client/heap/client.tsx`,
};
