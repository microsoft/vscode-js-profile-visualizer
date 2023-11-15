/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { Workerish } from './editorProvider';
import { handleMessage, prepareGraphParser } from './heapSnapshotLogic';

export const startWorker = async (uri: vscode.Uri): Promise<Workerish> => {
  const messageEmitter = new vscode.EventEmitter<unknown>();
  const graph = Promise.all([vscode.workspace.fs.readFile(uri), prepareGraphParser()]).then(
    ([bytes, parse]) => parse(bytes),
  );

  return {
    postMessage: m => handleMessage(graph, m).then(m => messageEmitter.fire(m)),
    onMessage: messageEmitter.event,
    terminate: () => graph.then(g => g.free()),
  };
};
