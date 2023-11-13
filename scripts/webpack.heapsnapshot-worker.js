const path = require('path');
const production = process.argv.includes('production');

module.exports = dirname => ({
  mode: production ? 'production' : 'development',
  devtool: production ? false : 'source-map',
  entry: '../vscode-js-profile-core/out/heapsnapshot/heapsnapshotWorker.js',
  target: 'node',
  output: {
    path: path.join(dirname, 'out'),
    filename: 'heapsnapshotWorker.js',
  },
  resolve: {
    conditionNames: ['bundler', 'module', 'require'],
  },
  experiments: {
    asyncWebAssembly: true,
  },
});
