/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export const enum Config {
  PollInterval = 'debug.flameGraph.realtimePollInterval',
  ViewDuration = 'debug.flameGraph.realtimeViewDuration',
  Easing = 'debug.flameGraph.realtimeEasing',
}

const allConfig = [Config.PollInterval, Config.ViewDuration, Config.Easing];

import { join } from 'path';
import * as vscode from 'vscode';
import { CpuProfileEditorProvider } from 'vscode-js-profile-core/out/cpu/editorProvider';
import { ProfileCodeLensProvider } from 'vscode-js-profile-core/out/profileCodeLensProvider';
import { RealtimeSessionTracker } from './realtimeSessionTracker';
import { RealtimeWebviewProvider } from './realtimeWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  const realtimeTracker = new RealtimeSessionTracker();
  const realtime = new RealtimeWebviewProvider(context.extensionUri, context, realtimeTracker);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.cpuprofile.flame',
      new CpuProfileEditorProvider(
        new ProfileCodeLensProvider(),
        join(__dirname, 'client.bundle.js'),
      ),
    ),

    vscode.window.registerWebviewViewProvider(RealtimeWebviewProvider.viewType, realtime),

    vscode.workspace.onDidChangeConfiguration(evt => {
      if (allConfig.some(c => evt.affectsConfiguration(c))) {
        realtime.updateSettings();
        realtimeTracker.updateSettings();
      }
    }),

    vscode.debug.onDidChangeActiveDebugSession(session =>
      realtimeTracker.onDidChangeActiveSession(session),
    ),

    vscode.debug.onDidTerminateDebugSession(session => realtimeTracker.onSessionDidEnd(session)),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // noop
}
