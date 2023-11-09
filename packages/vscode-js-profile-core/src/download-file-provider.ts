/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Downloads and displays remote content that the visualizer asks for.
 */
export class DownloadFileProvider implements vscode.TextDocumentContentProvider {
  /**
   * Scheme for the file provider.
   */
  public static readonly scheme = 'js-viz-download';

  /**
   * @inheritdoc
   */
  public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Retrieving ${uri.query}...`,
      },
      async () => {
        try {
          const res = await fetch(uri.query, {});
          const text = await res.text();
          return res.ok ? text : `Unexpected ${res.status} from ${uri.query}: ${text}`;
        } catch (e) {
          return (e as Error).message;
        }
      },
    );
  }
}
