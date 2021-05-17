/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { makeNonce, nonceHeader } from 'vscode-js-profile-core/out/nonce';
import { FromWebViewMessage, MessageType } from './realtime/protocol';
import { RealtimeSessionTracker } from './realtimeSessionTracker';

export class RealtimeWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-js-profile-flame.realtime';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly tracker: RealtimeSessionTracker,
  ) {}

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

    webviewView.webview.onDidReceiveMessage((evt: FromWebViewMessage) => {
      switch (evt.type) {
        case MessageType.SetEnabledMetrics:
          this.tracker.setEnabledMetrics(evt.keys);
          break;
        default:
        // ignored
      }
    });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'realtime.bundle.js'),
    );
    const nonce = makeNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
        ${nonceHeader(nonce)}
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Realtime Performance</title>
			</head>
      <body>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
      </html>
    `;
  }
}
