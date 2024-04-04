/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export const enum Config {
  PollInterval = 'debug.flameGraph.realtimePollInterval',
  ViewDuration = 'debug.flameGraph.realtimeViewDuration',
  Easing = 'debug.flameGraph.realtimeEasing',
}

const allConfig = [Config.PollInterval, Config.ViewDuration, Config.Easing];

import * as vscode from 'vscode';
import { CpuProfileEditorProvider } from 'vscode-js-profile-core/out/cpu/editorProvider';
import {
  createHeapSnapshotWorker,
  setupHeapSnapshotWebview,
} from 'vscode-js-profile-core/out/esm/heapsnapshot/editorProvider';
import { HeapProfileEditorProvider } from 'vscode-js-profile-core/out/heap/editorProvider';
import { ProfileCodeLensProvider } from 'vscode-js-profile-core/out/profileCodeLensProvider';
import { createMetrics } from './realtime/metrics';
import { RealtimeSessionTracker, readRealtimeSettings } from './realtimeSessionTracker';
import { RealtimeWebviewProvider } from './realtimeWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  const realtimeTracker = new RealtimeSessionTracker(context);
  const realtime = new RealtimeWebviewProvider(context.extensionUri, realtimeTracker);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.cpuprofile.flame',
      new CpuProfileEditorProvider(
        new ProfileCodeLensProvider(),
        vscode.Uri.joinPath(context.extensionUri, 'out', 'cpu-client.bundle.js'),
      ),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),

    vscode.window.registerCustomEditorProvider(
      'jsProfileVisualizer.heapprofile.flame',
      new HeapProfileEditorProvider(
        new ProfileCodeLensProvider(),
        vscode.Uri.joinPath(context.extensionUri, 'out', 'heap-client.bundle.js'),
      ),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),

    vscode.commands.registerCommand(
      'jsProfileVisualizer.heapsnapshot.flame.show',
      async ({ uri: rawUri, index, name }) => {
        const panel = vscode.window.createWebviewPanel(
          'jsProfileVisualizer.heapsnapshot.flame',
          vscode.l10n.t('Memory Graph: {0}', name),
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out')],
          },
        );

        const uri = vscode.Uri.parse(rawUri);
        const worker = await createHeapSnapshotWorker(uri);
        const webviewDisposable = await setupHeapSnapshotWebview(
          worker,
          vscode.Uri.joinPath(context.extensionUri, 'out', 'heapsnapshot-client.bundle.js'),
          uri,
          panel.webview,
          { SNAPSHOT_INDEX: index },
        );

        panel.onDidDispose(() => {
          worker.dispose();
          webviewDisposable.dispose();
        });
      },
    ),

    // there's no state we actually need to serialize/deserialize, but register
    // this so VS Code knows that it can
    vscode.window.registerWebviewPanelSerializer('jsProfileVisualizer.heapsnapshot.flame.show', {
      deserializeWebviewPanel() {
        return Promise.resolve();
      },
    }),

    vscode.window.registerWebviewViewProvider(RealtimeWebviewProvider.viewType, realtime),

    vscode.workspace.onDidChangeConfiguration(evt => {
      if (allConfig.some(c => evt.affectsConfiguration(c))) {
        realtimeTracker.updateSettings();
      }
    }),

    vscode.debug.onDidChangeActiveDebugSession(session =>
      realtimeTracker.onDidChangeActiveSession(session),
    ),

    vscode.debug.onDidStartDebugSession(session => realtimeTracker.onSessionDidStart(session)),
    vscode.debug.onDidTerminateDebugSession(session => realtimeTracker.onSessionDidEnd(session)),

    vscode.commands.registerCommand('vscode-js-profile-flame.setRealtimeCharts', async () => {
      const metrics = createMetrics();
      const settings = readRealtimeSettings(context);
      const quickpick = vscode.window.createQuickPick<{ label: string; index: number }>();

      quickpick.title = 'Toggle visible performance charts';
      quickpick.canSelectMany = true;
      quickpick.items = (realtimeTracker.currentData?.filter(m => m.hasData()) ?? metrics).map(
        (metric, i) => ({
          label: metric.name(),
          index: i,
        }),
      );
      quickpick.selectedItems = settings.enabledMetrics.length
        ? settings.enabledMetrics.map(index => quickpick.items[index])
        : quickpick.items.slice();

      quickpick.show();

      const chosen = await new Promise<number[] | undefined>(resolve => {
        quickpick.onDidAccept(() => resolve(quickpick.selectedItems.map(i => i.index)));
        quickpick.onDidHide(() => resolve(undefined));
      });

      quickpick.dispose();

      if (chosen) {
        realtimeTracker.setEnabledMetrics(chosen);
      }
    }),

    vscode.commands.registerCommand('vscode-js-profile-flame.splitCharts', () => {
      realtimeTracker.setSplitCharts(true);
    }),

    vscode.commands.registerCommand('vscode-js-profile-flame.collapseCharts', () => {
      realtimeTracker.setSplitCharts(false);
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {
  // noop
}
