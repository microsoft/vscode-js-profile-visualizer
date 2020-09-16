/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Metric } from './baseMetric';
import styles from './configurator.css';
import { Settings } from './settings';

export class Configurator {
  private metrics: {
    metric: Metric;
    element: HTMLElement;
    value: HTMLElement;
    enabled: boolean;
    available: boolean;
  }[] = [];

  public elem = document.createElement('div');

  public dispose = this.settings.onChange(() => this.applySettings());

  constructor(private readonly settings: Settings) {
    this.elem.classList.add(styles.configurator);

    for (const metric of settings.allMetrics) {
      const element = document.createElement('div');
      element.classList.add(styles.metric);
      element.addEventListener('click', () => settings.toggleMetric(metric));

      const label = document.createElement('span');
      label.classList.add(styles.label);
      label.innerText = metric.name();
      element.appendChild(label);

      const value = document.createElement('span');
      value.classList.add(styles.value);
      element.appendChild(value);

      this.metrics.push({ metric, element, enabled: false, available: false, value });
      this.elem.appendChild(element);
    }

    // move inactive items to the bottom always
    for (const { element, enabled } of this.metrics) {
      if (!enabled) {
        this.elem.appendChild(element);
      }
    }

    this.applySettings();
  }

  /**
   * Updates the configurator state for the metrics.
   */
  public updateMetrics() {
    for (const m of this.metrics) {
      if (m.metric.hasData() !== m.available) {
        m.available = m.metric.hasData();
        m.element.classList[m.metric.hasData() ? 'add' : 'remove'](styles.available);
      }

      if (m.available) {
        m.value.innerText = m.metric.format(m.metric.current);
      }
    }
  }

  private applySettings() {
    for (const m of this.metrics) {
      m.enabled = this.settings.enabledMetrics.includes(m.metric);
      m.element.classList[m.enabled ? 'add' : 'remove'](styles.enabled);
      m.element.style.setProperty('--metric-color', this.settings.metricColor(m.metric));
    }
  }
}
