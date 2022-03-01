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
import { CpuProfileAnnotations } from './cpuProfileAnnotations';
import { buildModel, IProfileModel } from './model';
import { ICpuProfileRaw } from './types';

export class CpuProfileEditorProvider
  implements vscode.CustomEditorProvider<ReadonlyCustomDocument<IProfileModel>> {
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
    const raw: ICpuProfileRaw = JSON.parse(new TextDecoder().decode(content));
    const document = new ReadonlyCustomDocument(uri, buildModel(raw));

    const annotations = new CpuProfileAnnotations();
    const rootPath = document.userData.rootPath;
    for (const location of document.userData.locations) {
      annotations.add(rootPath, location);
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
            rootPath: document.userData?.rootPath,
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
