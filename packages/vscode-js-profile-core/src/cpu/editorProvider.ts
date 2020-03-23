/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { ICpuProfileRaw, Message, IOpenDocumentMessage } from './types';
import { bundlePage } from '../bundlePage';
import { promises as fs } from 'fs';
import { properRelative } from '../pathUtils';
import { resolve } from 'path';
import { buildModel, IProfileModel } from './model';
import { LensCollection } from '../lensCollection';
import { ProfileCodeLensProvider } from '../profileCodeLensProvider';
import { reopenWithEditor } from '../reopenWithEditor';

const exists = async (file: string) => {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
};

const decimalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const integerFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export class CpuProfileEditorProvider implements vscode.CustomEditorProvider {
  constructor(private readonly lens: ProfileCodeLensProvider, private readonly bundle: string) {}

  /**
   * @inheritdoc
   */
  async resolveCustomDocument(document: vscode.CustomDocument<IProfileModel>): Promise<void> {
    const content = await vscode.workspace.fs.readFile(document.uri);
    const raw: ICpuProfileRaw = JSON.parse(content.toString());
    document.userData = buildModel(raw);
    this.lens.registerLenses(this.createLensCollection(document));
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
        case 'reopenWith':
          reopenWithEditor(document.uri, message.viewType, message.requireExtension);
          return;
        default:
          console.warn(`Unknown request from webview: ${JSON.stringify(message)}`);
      }
    });

    webviewPanel.webview.options = { enableScripts: true };
    webviewPanel.webview.html = await bundlePage(this.bundle, {
      MODEL: document.userData,
    });
  }

  private createLensCollection(document: vscode.CustomDocument<IProfileModel>) {
    const lenses = new LensCollection<{ self: number; agg: number; ticks: number }>(dto => {
      let title: string;
      if (dto.self > 10 || dto.agg > 10) {
        title =
          `${decimalFormat.format(dto.self / 1000)}ms Self Time / ` +
          `${decimalFormat.format(dto.agg / 1000)}ms Total`;
      } else if (dto.ticks) {
        title = `${integerFormat.format(dto.ticks)} Ticks`;
      } else {
        return;
      }

      return { command: '', title };
    });

    for (const location of document.userData?.locations || []) {
      const src = location.src;
      if (!src || src.source.sourceReference !== 0 || !src.source.path) {
        continue;
      }

      for (const path of getPossibleSourcePaths(document, src.source.path)) {
        lenses.set(
          path,
          new vscode.Position(Math.max(0, src.lineNumber - 1), Math.max(0, src.columnNumber - 1)),
          existing => ({
            ticks: (existing?.ticks || 0) + location.ticks,
            self: (existing?.self || 0) + location.selfTime,
            agg: (existing?.agg || 0) + location.aggregateTime,
          }),
        );
      }
    }

    return lenses;
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
    const candidates = getPossibleSourcePaths(document, originalPath);
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }
}

const getPossibleSourcePaths = (
  document: vscode.CustomDocument<IProfileModel>,
  originalPath: string,
) => {
  const locations = [originalPath];
  if (document.userData?.rootPath) {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (folder) {
      // compute the relative path using the original platform's logic, and
      // then resolve it using the current platform
      locations.push(
        resolve(folder.uri.fsPath, properRelative(document.userData.rootPath, originalPath)),
      );
    }
  }

  return locations;
};
