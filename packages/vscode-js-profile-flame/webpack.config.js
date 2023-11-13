module.exports = [
  require('../../scripts/webpack.heapsnapshot-worker')(__dirname),
  require('../../scripts/webpack.extension')(__dirname, 'node'),
  ...(process.argv.includes('--watch')
    ? []
    : [require('../../scripts/webpack.extension')(__dirname, 'web')]),
  {
    ...require('../../scripts/webpack.client')(__dirname, 'realtime'),
    entry: `./src/realtime/client.ts`,
  },
  {
    ...require('../../scripts/webpack.client')(__dirname, 'heap-client'),
    entry: `./src/client/heap/client.tsx`,
  },
  {
    ...require('../../scripts/webpack.client')(__dirname, 'cpu-client'),
    entry: `./src/client/cpu/client.tsx`,
  },
  {
    ...require('../../scripts/webpack.client')(__dirname, 'heapsnapshot-client'),
    entry: `./src/heapsnapshot-client/client.tsx`,
  },
];
