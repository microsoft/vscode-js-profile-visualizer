/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as vscode from 'vscode';
import { MessageType, ToWebViewMessage } from './realtime/protocol';

/**
 * Generates test data for quick development setup.
 */
export function sendTestData(webviewView: vscode.WebviewView) {
  let cpuTime = 0;
  let x = 0;
  let z = 1;
  const i = setInterval(() => {
    const message: ToWebViewMessage = {
      type: MessageType.AddData,
      data: {
        timestamp: Date.now(),
        cpu: { system: cpuTime, user: cpuTime },
        memory: { rss: (Math.sin(x) * 20 + 40) * 1024 * 1024 } as unknown as NodeJS.MemoryUsage,
      },
    };
    x += 0.1;
    if (Math.floor(z++ / 2) % 2 === 0) {
      cpuTime += ((Math.cos(x) + 1) / 2) * 1000 * 1000;
    }

    webviewView.webview.postMessage(message);
  }, 1000);

  webviewView.onDidDispose(() => {
    clearInterval(i);
  });
}
