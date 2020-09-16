/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { Config } from './extension';
import { Metric } from './realtime/baseMetric';
import { createMetrics } from './realtime/metrics';
import {
  getSteps,
  IDAMetrics,
  ISettings,
  MessageType,
  ToWebViewMessage,
} from './realtime/protocol';

export const readRealtimeSettings = (): ISettings => {
  const config = vscode.workspace.getConfiguration();
  return {
    easing:
      config.get(Config.Easing) ??
      vscode.window.activeColorTheme.kind !== vscode.ColorThemeKind.HighContrast,
    pollInterval: config.get(Config.PollInterval, 1000),
    viewDuration: config.get(Config.ViewDuration, 30_000),
    zoomLevel: config.get('window.zoomLevel', 0),
  };
};

interface ISessionData {
  session: vscode.DebugSession;
  metrics: Metric[];
  cts: vscode.CancellationTokenSource;
}

/**
 * Tracks ongoing debug sessions and webviews. While there's any visible
 * webview, we'll collect metrics for any debug session that is or becomes
 * active.
 */
export class RealtimeSessionTracker {
  private settings = readRealtimeSettings();
  private webviews = new Set<vscode.WebviewView>();
  private sessionData = new Map<vscode.DebugSession, ISessionData>();
  private displayedSession?: vscode.DebugSession;
  private hasVisibleSession = false;

  /**
   * Returns any realtime metric webviews that are currently visible.
   */
  public get visibleWebviews() {
    return [...this.webviews].filter(w => w.visible);
  }

  /**
   * Adds a webview to the session tracking.
   */
  public trackWebview(webview: vscode.WebviewView) {
    this.webviews.add(webview);
    webview.onDidChangeVisibility(() => {
      this.recalcVisibility();
    });

    webview.onDidDispose(() => {
      this.webviews.delete(webview);
      this.recalcVisibility();
    });

    this.recalcVisibility();
  }

  /**
   * Should be called when the active debug session changes so we start
   * tracking it.
   */
  public onDidChangeActiveSession(session: vscode.DebugSession | undefined) {
    if (
      !this.visibleWebviews.length ||
      !session?.type.startsWith('pwa-') ||
      !('__pendingTargetId' in session.configuration)
    ) {
      return;
    }

    let data = this.sessionData.get(session);
    if (!data) {
      data = {
        session,
        metrics: createMetrics(),
        cts: new vscode.CancellationTokenSource(),
      };

      for (const metric of data.metrics) {
        metric.reset(getSteps(this.settings) + 3);
      }

      this.collectFromSession(data);
      this.sessionData.set(session, data);
    }

    this.displayedSession = session;
    this.postMessage({ type: MessageType.ApplyData, data: data.metrics.map(m => m.metrics) });
  }

  /**
   * Called when a debug session ends. Disposes of the metric collection
   * interval and metric data.
   */
  public onSessionDidEnd(session: vscode.DebugSession) {
    const data = this.sessionData.get(session);
    if (data) {
      data.cts.cancel();
      this.sessionData.delete(session);
    }

    if (this.displayedSession === session) {
      this.displayedSession = undefined;
    }
  }

  /**
   * Should be called when settings update.
   */
  public updateSettings() {
    this.settings = readRealtimeSettings();
    const steps = getSteps(this.settings);

    for (const { metrics } of this.sessionData.values()) {
      for (const metric of metrics) {
        metric.reset(steps + 3); // no-ops if the steps are already the same
      }
    }
  }

  private collectFromSession(data: ISessionData) {
    const loop = () => {
      data.session.customRequest('getPerformance').then((r: { metrics?: IDAMetrics }) => {
        if (data.cts.token.isCancellationRequested) {
          return;
        }

        if (r.metrics) {
          r.metrics.timestamp = r.metrics.timestamp || r.metrics.Timestamp || Date.now();
          this.onMetrics(data, r.metrics);
        }

        const timeout = setTimeout(() => {
          listener.dispose();
          loop();
        }, this.settings.pollInterval);

        const listener = data.cts.token.onCancellationRequested(() => {
          clearTimeout(timeout);
        });
      });
    };

    loop();
  }

  private onMetrics({ session, metrics }: ISessionData, v: IDAMetrics) {
    for (const metric of metrics) {
      metric.update(v.timestamp, v);
    }

    if (session === this.displayedSession) {
      this.postMessage({ type: MessageType.AddData, data: v });
    }
  }

  private postMessage(message: ToWebViewMessage) {
    for (const webview of this.visibleWebviews) {
      webview.webview.postMessage(message);
    }
  }

  private recalcVisibility() {
    const wasVisible = this.hasVisibleSession;
    const visible = [...this.webviews].some(w => w.visible);
    this.hasVisibleSession = visible;
    if (visible && !wasVisible) {
      this.onDidChangeActiveSession(vscode.debug.activeDebugSession);
    } else if (!visible) {
      for (const session of this.sessionData.keys()) {
        this.onSessionDidEnd(session);
      }
    }
  }
}
