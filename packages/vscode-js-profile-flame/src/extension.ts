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
import { createMetrics } from './realtime/metrics';
import { readRealtimeSettings, RealtimeSessionTracker } from './realtimeSessionTracker';
import { RealtimeWebviewProvider } from './realtimeWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  const realtimeTracker = new RealtimeSessionTracker(context);
  const realtime = new RealtimeWebviewProvider(context.extensionUri, realtimeTracker);

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
        realtimeTracker.updateSettings();
      }
    }),

    vscode.debug.onDidChangeActiveDebugSession(session =>
      realtimeTracker.onDidChangeActiveSession(session),
    ),

    vscode.debug.onDidTerminateDebugSession(session => realtimeTracker.onSessionDidEnd(session)),

    vscode.commands.registerCommand('vscode-js-profile-flame.setRealtimeCharts', async () => {
      const metrics = createMetrics();
      const settings = readRealtimeSettings(context);
      const quickpick = vscode.window.createQuickPick<{ label: string; index: number }>();

      quickpick.canSelectMany = true;
      quickpick.items = metrics.map((metric, i) => ({
        label: metric.name(),
        index: i,
      }));
      quickpick.selectedItems = settings.enabledMetrics.length
        ? settings.enabledMetrics.map(index => quickpick.items[index])
        : quickpick.items.slice();

      quickpick.show();

      const chosen = await new Promise<number[] | undefined>(resolve => {
        quickpick.onDidAccept(() => resolve(quickpick.selectedItems.map(i => i.index)));
        quickpick.onDidHide(() => resolve(undefined));
      });

      quickpick.dispose();

      if (!chosen || !chosen.length) {
        return;
      }

      realtimeTracker.setEnabledMetrics(chosen);
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // noop
}
