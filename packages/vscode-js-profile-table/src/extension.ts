/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { CpuProfileEditorProvider } from 'vscode-js-profile-core/out/cpu/editorProvider';
import { DownloadFileProvider } from 'vscode-js-profile-core/out/download-file-provider';
import { HeapProfileEditorProvider } from 'vscode-js-profile-core/out/heap/editorProvider';
import { HeapSnapshotEditorProvider } from 'vscode-js-profile-core/out/heapsnapshot/editorProvider';
import { ProfileCodeLensProvider } from 'vscode-js-profile-core/out/profileCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
  const lenses = new ProfileCodeLensProvider();

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.cpuprofile.table',
      new CpuProfileEditorProvider(
        lenses,
        vscode.Uri.joinPath(context.extensionUri, 'out', 'cpu-client.bundle.js'),
      ),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.heapprofile.table',
      new HeapProfileEditorProvider(
        lenses,
        vscode.Uri.joinPath(context.extensionUri, 'out', 'heap-client.bundle.js'),
      ),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.heapsnapshot.table',
      new HeapSnapshotEditorProvider(
        vscode.Uri.joinPath(context.extensionUri, 'out', 'heapsnapshot-client.bundle.js'),
      ),
      // note: context is not retained when hidden, unlike other editors, because
      // the model is kept in a worker_thread and accessed via RPC
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
