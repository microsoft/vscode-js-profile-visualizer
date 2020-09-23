/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Color, observeColors } from 'vscode-webview-tools';
import { Metric } from './baseMetric';
import { createMetrics } from './metrics';
import { getSteps, ISettings, MessageType } from './protocol';
import { IVscodeApi } from './vscodeApi';

declare const DEFAULT_ENABLED_METRICS: number[];

export class Settings {
  private changeListeners: (() => void)[] = [];

  public value: ISettings = {
    pollInterval: 1000,
    viewDuration: 30_000,
    zoomLevel: 0,
    enabledMetrics: [],
    splitCharts: false,
    easing: true,
  };

  public colors!: {
    background: string;
    border: string;
    foreground: string;
    primaryGraph: string;
    secondaryGraph: string;
  };

  public allMetrics = createMetrics();

  public get enabledMetrics() {
    return this.value.enabledMetrics.map(i => this.allMetrics[i]).filter(Boolean);
  }

  public steps = 0;

  constructor(private readonly api: IVscodeApi) {
    this.update(this.value);

    observeColors(c => {
      this.colors = {
        background: c[Color.SideBarBackground],
        foreground: c[Color.SideBarForeground] || c[Color.Foreground],
        border: c[Color.TreeIndentGuidesStroke],
        primaryGraph: c[Color.ListErrorForeground],
        secondaryGraph: c[Color.ListWarningForeground],
      };
      this.fireChange();
    });
  }

  public metricColor(metric: Metric) {
    return metric === this.enabledMetrics[0]
      ? this.colors.primaryGraph
      : this.colors.secondaryGraph;
  }

  public onChange(listener: () => void) {
    this.changeListeners.push(listener);
    return () => (this.changeListeners = this.changeListeners.filter(c => c !== listener));
  }

  public setEnabledMetrics(metrics: ReadonlyArray<Metric>) {
    if (
      metrics.length === this.enabledMetrics.length &&
      !metrics.some(m => !this.enabledMetrics.includes(m))
    ) {
      return;
    }

    this.api.postMessage({
      type: MessageType.SetEnabledMetrics,
      keys: metrics.map(m => this.allMetrics.indexOf(m)),
    });

    this.fireChange();
  }

  public toggleMetric(metric: Metric) {
    const enabledMetrics = this.enabledMetrics.includes(metric)
      ? this.enabledMetrics.filter(e => e !== metric)
      : this.enabledMetrics.concat(metric);

    this.setEnabledMetrics(enabledMetrics);
  }

  public update(newValue: ISettings) {
    this.value = newValue;
    this.steps = getSteps(newValue);
    this.fireChange();
  }

  private fireChange() {
    for (const l of this.changeListeners) {
      l();
    }
  }
}
