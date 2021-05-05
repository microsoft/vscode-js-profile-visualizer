/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { CpuProfileEditorProvider } from 'vscode-js-profile-core/out/cpu/editorProvider';
import { DownloadFileProvider } from 'vscode-js-profile-core/out/download-file-provider';
import { ProfileCodeLensProvider } from 'vscode-js-profile-core/out/profileCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
  const lenses = new ProfileCodeLensProvider();

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.cpuprofile.table',
      new CpuProfileEditorProvider(
        lenses,
        vscode.Uri.joinPath(context.extensionUri, 'out', 'client.bundle.js'),
      ),
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      'js-viz-download',
      new DownloadFileProvider(),
    ),
    vscode.languages.registerCodeLensProvider('*', lenses),
    vscode.commands.registerCommand('extension.jsProfileVisualizer.table.clearCodeLenses', () =>
      lenses.clear(),
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // noop
}
