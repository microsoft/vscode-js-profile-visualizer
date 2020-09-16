/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { FromWebViewMessage, MessageType, ToWebViewMessage } from './realtime/protocol';
import { readRealtimeSettings, RealtimeSessionTracker } from './realtimeSessionTracker';

const enabledMetricsKey = 'enabledMetrics';

export class RealtimeWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-js-profile-flame.realtime';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
    private readonly tracker: RealtimeSessionTracker,
  ) {}

  /**
   * Pushes a settings up to all active webviews.
   */
  public updateSettings() {
    const message = this.getSettingsUpdate();
    for (const view of this.tracker.visibleWebviews) {
      view.webview.postMessage(message);
    }
  }

  /**
   * @inheritdoc
   */
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.tracker.trackWebview(webviewView);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        webviewView.webview.postMessage(this.getSettingsUpdate());
      }
    });

    webviewView.webview.postMessage(this.getSettingsUpdate());

    webviewView.webview.onDidReceiveMessage((evt: FromWebViewMessage) => {
      switch (evt.type) {
        case MessageType.SetEnabledMetrics:
          this.context.workspaceState.update(enabledMetricsKey, evt.keys);
          break;
        default:
        // ignored
      }
    });
  }

  private getSettingsUpdate() {
    const settings = readRealtimeSettings();
    const message: ToWebViewMessage = { type: MessageType.UpdateSettings, settings };
    return message;
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'realtime.bundle.js'),
    );
    const nonce = randomBytes(16).toString('hex');
    const metrics = this.context.workspaceState.get(enabledMetricsKey, [0, 1]);

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Realtime Performance</title>
			</head>
      <body>
        <script nonce="${nonce}">window.DEFAULT_ENABLED_METRICS=${JSON.stringify(metrics)}</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
      </html>
    `;
  }
}
