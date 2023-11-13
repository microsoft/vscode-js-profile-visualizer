/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

export function reopenWithEditor(
  uri: vscode.Uri,
  viewType: string,
  requireExtension?: string,
  toSide?: boolean,
) {
  if (requireExtension && !vscode.extensions.all.some(e => e.id === requireExtension)) {
    vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [
      requireExtension,
    ]);
  } else {
    vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      viewType,
      toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
    );
  }
}
