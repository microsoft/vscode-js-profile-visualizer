/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { bundlePage } from '../bundlePage';
import { Message } from '../common/types';
import { openLocation } from '../open-location';
import { ProfileCodeLensProvider } from '../profileCodeLensProvider';
import { ReadonlyCustomDocument } from '../readonly-custom-document';
import { reopenWithEditor } from '../reopenWithEditor';
import { HeapProfileAnnotations } from './heapProfileAnnotations';
import { buildModel, IHeapProfileRaw, IProfileModel, ITreeNode } from './model';
import { createTree } from './tree';

export class HeapProfileEditorProvider
  implements vscode.CustomEditorProvider<ReadonlyCustomDocument<IProfileModel>>
{
  public readonly onDidChangeCustomDocument = new vscode.EventEmitter<never>().event;

  constructor(
    private readonly lens: ProfileCodeLensProvider,
    private readonly bundle: vscode.Uri,
    private readonly extraConsts: Record<string, unknown> = {},
  ) {}

  /**
   * @inheritdoc
   */
  async openCustomDocument(uri: vscode.Uri) {
    const content = await vscode.workspace.fs.readFile(uri);
    const raw: IHeapProfileRaw = JSON.parse(new TextDecoder().decode(content));
    const document = new ReadonlyCustomDocument(uri, buildModel(raw));

    const tree = createTree(document.userData);
    const treeNodes: ITreeNode[] = [tree];
    let nodes: ITreeNode[] = [tree];

    while (nodes.length) {
      const node = nodes.pop();
      if (node) {
        treeNodes.push(node);
        if (node.children) {
          nodes = nodes.concat(Object.values(node.children));
        }
      }
    }

    const annotations = new HeapProfileAnnotations();
    const rootPath = document.userData.rootPath;
    for (const treeNode of treeNodes) {
      annotations.add(rootPath, treeNode);
    }

    this.lens.registerLenses(annotations);
    return document;
  }

  /**
   * @inheritdoc
   */
  public async resolveCustomEditor(
    document: ReadonlyCustomDocument<IProfileModel>,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.onDidReceiveMessage((message: Message) => {
      switch (message.type) {
        case 'openDocument':
          openLocation({
            rootPath: undefined,
            viewColumn: message.toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
            callFrame: message.callFrame,
            location: message.location,
          });
          return;
        case 'reopenWith':
          reopenWithEditor(document.uri, message.viewType, message.requireExtension);
          return;
        default:
          console.warn(`Unknown request from webview: ${JSON.stringify(message)}`);
      }
    });

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = await bundlePage(webviewPanel.webview.asWebviewUri(this.bundle), {
      MODEL: document.userData,
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
  public saveCustomDocumentAs(
    document: ReadonlyCustomDocument<IProfileModel>,
    destination: vscode.Uri,
  ) {
    return vscode.workspace.fs.copy(document.uri, destination, { overwrite: true });
  }
}
