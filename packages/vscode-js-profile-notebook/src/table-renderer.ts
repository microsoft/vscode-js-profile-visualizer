/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { Constants } from './types';
import { join } from 'path';

export class TableRenderer implements vscode.NotebookOutputRenderer {
  public readonly preloads: vscode.Uri[] = [];

  constructor(extensionPath: string) {
    this.preloads.push(vscode.Uri.file(join(extensionPath, 'out', 'table-client.bundle.js')));
  }

  render(_document: vscode.NotebookDocument, output: vscode.CellOutput): string {
    if (output.outputKind !== vscode.CellOutputKind.Rich) {
      return '';
    }

    if (output.data[Constants.TableMimeType] === undefined) {
      return '';
    }

    return `
      <script type="${Constants.TableMimeType}"
        onload="window.renderTableTag && window.renderTableTab(document.currentScript)">
        ${JSON.stringify(output.data[Constants.TableMimeType])}
      </script>
    `;
  }
}
