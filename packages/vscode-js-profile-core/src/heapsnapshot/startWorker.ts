/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import { Workerish } from './editorProvider';

export const startWorker = async (uri: vscode.Uri): Promise<Workerish> => {
  const w = new Worker(`${__dirname}/heapsnapshotWorker.js`, {
    workerData: uri.scheme === 'file' ? uri.fsPath : await vscode.workspace.fs.readFile(uri),
  });

  return {
    postMessage: m => w.postMessage(m),
    onMessage: l => {
      w.on('message', l);
      return { dispose: () => w.off('message', l) };
    },
    terminate: async () => {
      await w.terminate();
    },
  };
};
