/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Color, observeColors } from 'vscode-webview-tools';
import { Metric } from './baseMetric';
import { createMetrics } from './metrics';
import { ISettings, MessageType, getSteps } from './protocol';
import { IVscodeApi } from './vscodeApi';

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
    graphs: string[];
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
        graphs: [
          c[Color.ChartsRed],
          c[Color.ChartsYellow],
          c[Color.ChartsBlue],
          c[Color.ChartsOrange],
          c[Color.ChartsPurple],
          c[Color.ChartsGreen],
        ],
      };
      this.fireChange();
    });
  }

  public metricColor(metric: Metric) {
    const colors = this.colors.graphs;
    return colors[this.allMetrics.indexOf(metric) % colors.length];
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
