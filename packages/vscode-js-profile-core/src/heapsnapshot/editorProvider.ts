/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { bundlePage } from '../bundlePage';
import { Message } from '../common/types';
import { reopenWithEditor } from '../reopenWithEditor';
import { GraphRPCCall } from './rpc';
import { startWorker } from './startWorker';

export interface Workerish {
  postMessage(message: GraphRPCCall): void;
  onMessage(listener: (message: unknown) => void): vscode.Disposable;
  terminate(): Promise<void>;
}

interface IWorker extends vscode.Disposable {
  worker: Workerish;
}

class HeapSnapshotDocument implements vscode.CustomDocument {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly value: IWorker,
  ) {}

  /**
   * @inheritdoc
   */
  public dispose() {
    this.value.dispose();
  }
}

// a bit of a hack: the table and flame chart views are separate extensions,
// and the user can open heap retainers in the flame view, but we don't want
// to have to parse the heap profile twice to get the same info. So have a
// global collection the other extension can access.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerRegistry = ((globalThis as any).__jsHeapSnapshotWorkers ??= new (class {
  private readonly workers = new Map<
    /* uri */ string,
    { worker: Workerish; rc: number; closer?: NodeJS.Timeout }
  >();
  public async create(uri: vscode.Uri): Promise<IWorker> {
    let rec = this.workers.get(uri.with({ query: '' }).toString());
    if (!rec) {
      const worker = await startWorker(uri);
      rec = { worker, rc: 0 };
      this.workers.set(uri.toString(), rec);
    }

    rec.rc++;
    if (rec.closer) {
      clearTimeout(rec.closer);
      rec.closer = undefined;
    }

    return {
      worker: rec.worker,
      dispose: () => {
        if (!--rec!.rc) {
          // avoid stopping the worker if the webview was just moved around:
          rec!.closer = setTimeout(() => {
            rec!.worker.terminate();
            this.workers.delete(uri.toString());
          }, 5000);
        }
      },
    };
  }
})());

export class HeapSnapshotEditorProvider
  implements vscode.CustomEditorProvider<HeapSnapshotDocument>
{
  public readonly onDidChangeCustomDocument = new vscode.EventEmitter<never>().event;

  constructor(
    private readonly bundle: vscode.Uri,
    private readonly extraConsts: Record<string, unknown> = {},
  ) {}

  /**
   * @inheritdoc
   */
  async openCustomDocument(uri: vscode.Uri) {
    const worker = await workerRegistry.create(uri);
    return new HeapSnapshotDocument(uri, worker);
  }

  /**
   * @inheritdoc
   */
  public async resolveCustomEditor(
    document: HeapSnapshotDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.onDidReceiveMessage((message: Message) => {
      switch (message.type) {
        case 'reopenWith':
          reopenWithEditor(
            document.uri.with({ query: message.withQuery }),
            message.viewType,
            message.requireExtension,
            message.toSide,
          );
          return;
        case 'callGraph':
          document.value.worker.postMessage(message.inner);
          return;
        default:
          console.warn(`Unknown request from webview: ${JSON.stringify(message)}`);
      }
    });

    const listener = document.value.worker.onMessage((message: unknown) => {
      webviewPanel.webview.postMessage({ method: 'graphRet', message });
    });
    webviewPanel.onDidDispose(() => {
      listener.dispose();
    });

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = await bundlePage(webviewPanel.webview.asWebviewUri(this.bundle), {
      SNAPSHOT_URI: webviewPanel.webview.asWebviewUri(document.uri).toString(),
      DOCUMENT_URI: document.uri.toString(),
      ...this.extraConsts,
    });
  }

  /**
   * @inheritdoc
   */
  public async saveCustomDocument() {
    // no-op
  }

  /**
   * @inheritdoc
   */
  public async revertCustomDocument() {
    // no-op
  }

  /**
   * @inheritdoc
   */
  public async backupCustomDocument() {
    return { id: '', delete: () => undefined };
  }

  /**
   * @inheritdoc
   */
  public saveCustomDocumentAs(document: HeapSnapshotDocument, destination: vscode.Uri) {
    return vscode.workspace.fs.copy(document.uri, destination, { overwrite: true });
  }
}
