/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { ICpuProfileRaw, Message, IOpenDocumentMessage } from './types';
import { bundlePage } from '../common/bundlePage';
import { promises as fs } from 'fs';
import { properRelative } from '../common/pathUtils';
import { resolve, join } from 'path';
import { buildModel, IProfileModel } from './model';

const exists = async (file: string) => {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
};

export class CpuProfileEditorProvider implements vscode.CustomEditorProvider {
  /**
   * @inheritdoc
   */
  async resolveCustomDocument(document: vscode.CustomDocument<IProfileModel>): Promise<void> {
    const content = await vscode.workspace.fs.readFile(document.uri);
    const raw: ICpuProfileRaw = JSON.parse(content.toString());
    document.userData = buildModel(raw);
  }

  /**
   * @inheritdoc
   */
  public async resolveCustomEditor(
    document: vscode.CustomDocument<IProfileModel>,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    webviewPanel.webview.onDidReceiveMessage((message: Message) => {
      switch (message.type) {
        case 'openDocument':
          this.openDocument(document, message);
          return;
        default:
          console.warn(`Unknown request from webview: ${JSON.stringify(message)}`);
      }
    });

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = await bundlePage(join(__dirname, '..', 'cpu.js'), {
      MODEL: document.userData,
    });
  }

  private async openDocument(
    document: vscode.CustomDocument<IProfileModel>,
    message: IOpenDocumentMessage,
  ) {
    const uri = vscode.Uri.file(await this.getBestFilePath(document, message.path));
    const doc = await vscode.workspace.openTextDocument(uri);
    const pos = new vscode.Position(message.lineNumber - 1, message.columnNumber - 1);
    await vscode.window.showTextDocument(doc, {
      viewColumn: message.toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
      selection: new vscode.Range(pos, pos),
    });
  }

  private async getBestFilePath(
    document: vscode.CustomDocument<IProfileModel>,
    originalPath: string,
  ) {
    if (await exists(originalPath)) {
      return originalPath;
    }

    if (!document.userData?.rootPath) {
      return originalPath;
    }

    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
      return originalPath;
    }

    // compute the relative path using the original platform's logic, and
    // then resolve it using the current platform
    return resolve(folder.uri.fsPath, properRelative(document.userData.rootPath, originalPath));
  }
}
