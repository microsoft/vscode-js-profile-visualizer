/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { Constants } from './types';
import { NotebookProvider } from './notebook-provider';
import { TableRenderer } from './table-renderer';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.notebook.registerNotebookProvider(Constants.ViewType, new NotebookProvider()),
  );
  context.subscriptions.push(
    vscode.notebook.registerNotebookOutputRenderer(
      Constants.ViewType,
      {
        type: 'display_data',
        subTypes: [Constants.TableMimeType],
      },
      new TableRenderer(context.extensionPath),
    ),
  );
}
