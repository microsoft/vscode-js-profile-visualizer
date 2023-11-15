/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFile } from 'fs/promises';
import { parentPort, workerData } from 'worker_threads';
import { handleMessage, prepareGraphParser } from './heapSnapshotLogic';
import { GraphRPCCall } from './rpc';

if (!parentPort) {
  throw new Error('must be run in worker thread');
}

const graph = Promise.all([
  typeof workerData === 'string' ? readFile(workerData) : Promise.resolve(workerData as Uint8Array),
  prepareGraphParser(),
]).then(async ([f, r]) => r(f));

parentPort.on('message', (message: GraphRPCCall) => {
  handleMessage(graph, message).then(m => parentPort!.postMessage(m));
});
