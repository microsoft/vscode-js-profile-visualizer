/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { join } from 'path';
import * as vscode from 'vscode';
import { CpuProfileEditorProvider } from 'vscode-js-profile-core/out/cpu/editorProvider';
import { ProfileCodeLensProvider } from 'vscode-js-profile-core/out/profileCodeLensProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.cpuprofile.flame',
      new CpuProfileEditorProvider(
        new ProfileCodeLensProvider(),
        join(__dirname, 'client.bundle.js'),
      ),
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // noop
}
