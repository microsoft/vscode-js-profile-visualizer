/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

export function requireExtension<T>(extension: string | undefined, thenDo: () => T): T | undefined {
  if (extension && !vscode.extensions.all.some(e => e.id === extension)) {
    vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [
      extension,
    ]);
    return undefined;
  }

  return thenDo();
}

export function reopenWithEditor(
  uri: vscode.Uri,
  viewType: string,
  requireExtensionId?: string,
  toSide?: boolean,
) {
  return requireExtension(requireExtensionId, () =>
    vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      viewType,
      toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
    ),
  );
}
