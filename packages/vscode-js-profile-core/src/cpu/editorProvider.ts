/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { ICpuProfileRaw, Message } from './types';
import { bundlePage } from '../bundlePage';
import { buildModel, IProfileModel, ILocation } from './model';
import { LensCollection } from '../lens-collection';
import { ProfileCodeLensProvider } from '../profileCodeLensProvider';
import { reopenWithEditor } from '../reopenWithEditor';
import { openLocation, getCandidateDiskPaths } from '../open-location';

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
    webviewPanel.webview.html = await bundlePage(this.bundle, {
      MODEL: document.userData,
    });
  }

  private createLensCollection(document: vscode.CustomDocument<IProfileModel>) {
    type LensData = { self: number; agg: number; ticks: number };

    const lenses = new LensCollection<LensData>(dto => {
      let title: string;
      if (dto.self > 10 || dto.agg > 10) {
        title =
          `${decimalFormat.format(dto.self / 1000)}ms Self Time, ` +
          `${decimalFormat.format(dto.agg / 1000)}ms Total`;
      } else if (dto.ticks) {
        title = `${integerFormat.format(dto.ticks)} Ticks`;
      } else {
        return;
      }

      return { command: '', title };
    });

    const merge = (location: ILocation) => (existing?: LensData) => ({
      ticks: (existing?.ticks || 0) + location.ticks,
      self: (existing?.self || 0) + location.selfTime,
      agg: (existing?.agg || 0) + location.aggregateTime,
    });

    for (const location of document.userData?.locations || []) {
      const mergeFn = merge(location);
      lenses.set(
        location.callFrame.url,
        new vscode.Position(
          Math.max(0, location.callFrame.lineNumber),
          Math.max(0, location.callFrame.columnNumber),
        ),
        mergeFn,
      );

      const src = location.src;
      if (!src || src.source.sourceReference !== 0 || !src.source.path) {
        continue;
      }

      for (const path of getCandidateDiskPaths(document.userData?.rootPath, src.source)) {
        lenses.set(
          path,
          new vscode.Position(Math.max(0, src.lineNumber - 1), Math.max(0, src.columnNumber - 1)),
          mergeFn,
        );
      }
    }

    return lenses;
  }
}
