module.exports = [
  require('../../scripts/webpack.heapsnapshot-worker')(__dirname),
  require('../../scripts/webpack.extension')(__dirname, 'node'),
  ...(process.argv.includes('--watch')
    ? []
    : [require('../../scripts/webpack.extension')(__dirname, 'web')]),
  {
    ...require('../../scripts/webpack.client')(__dirname, 'cpu-client'),
    entry: `./src/cpu-client/client.tsx`,
  },
  {
    ...require('../../scripts/webpack.client')(__dirname, 'heap-client'),
    entry: `./src/heap-client/client.tsx`,
  },
  {
    ...require('../../scripts/webpack.client')(__dirname, 'heapsnapshot-client'),
    entry: `./src/heapsnapshot-client/client.tsx`,
  },
];
