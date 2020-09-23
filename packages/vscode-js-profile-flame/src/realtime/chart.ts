/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Metric } from './baseMetric';
import styles from './chart.css';
import { Configurator } from './configurator';
import { FrameCanvas, Sizing } from './frameCanvas';
import { Settings } from './settings';

const naturalAspectRatio = 16 / 9;
const autoOpenAspectRatio = 4 / 3;
const autoCloseAspectRatio = (naturalAspectRatio + autoOpenAspectRatio) / 2;

const openToSideWidth = 250;
const openToSideMinSpace = 600;

export class Chart {
  private valElements: [Metric, { max: HTMLElement; val: HTMLElement }][] = [];
  private configOpen = false;
  private configHadManualToggle = false;
  private hasAnyData = false;

  private readonly frameCanvas = new FrameCanvas(this.width, this.height, this.settings);
  private readonly elements = this.createElements();
  private readonly settingListener = this.settings.onChange(() => this.applySettings());
  private readonly configurator = new Configurator(this.settings);

  public get elem() {
    return this.elements.container;
  }

  constructor(private width: number, private height: number, private readonly settings: Settings) {
    this.setConfiguratorOpen(width / height < autoOpenAspectRatio);
    this.applySettings();
  }

  public dispose() {
    this.settingListener();
    this.frameCanvas.dispose();
  }

  /**
   * Update the size of the displayed chart.
   */
  public updateSize(width: number, height: number) {
    if (!this.configHadManualToggle) {
      const ratio = width / height;
      if (ratio < autoOpenAspectRatio) {
        this.setConfiguratorOpen(true);
      } else if (ratio > autoCloseAspectRatio) {
        this.setConfiguratorOpen(false);
      }
    }

    this.width = width;
    this.height = height;

    let graphHeight: number;
    let graphWidth: number;
    if (!this.configOpen) {
      graphHeight = height - Sizing.LabelHeight;
      graphWidth = width;
    } else if (width < openToSideMinSpace) {
      const cfgrect = this.configurator.elem.getBoundingClientRect();
      graphHeight = height - cfgrect.height;
      graphWidth = width;
    } else {
      graphHeight = height;
      graphWidth = width - openToSideWidth;
    }

    this.frameCanvas.updateSize(graphWidth, graphHeight);
  }

  /**
   * Update the chart metrics
   */
  public updateMetrics() {
    this.frameCanvas.updateMetrics();

    if (this.configOpen) {
      this.configurator.updateMetrics();
    }

    for (const [metric, { val, max }] of this.valElements) {
      max.innerText = metric.format(metric.maxY);
      val.innerText = metric.format(metric.current);
    }

    this.setHasData(this.settings.allMetrics.some(m => m.hasData()));
  }

  private setHasData(hasData: boolean) {
    if (hasData === this.hasAnyData) {
      return;
    }

    this.elements.container.classList[hasData ? 'remove' : 'add'](styles.noData);
  }

  private setConfiguratorOpen(isOpen: boolean) {
    if (isOpen === this.configOpen) {
      return;
    }

    this.configOpen = isOpen;
    if (isOpen) {
      this.configurator.updateMetrics();
      this.elem.appendChild(this.configurator.elem);
      this.elem.removeChild(this.elements.labelList);
      document.body.style.overflowY = 'auto';
      this.elements.container.classList.add(styles.configOpen);
    } else {
      this.elem.removeChild(this.configurator.elem);
      this.elem.appendChild(this.elements.labelList);
      document.body.style.overflowY = 'hidden';
      this.elements.container.classList.remove(styles.configOpen);
    }
  }

  private createElements() {
    const container = document.createElement('div');
    container.classList.add(styles.container, styles.noData);
    container.style.setProperty('--primary-series-color', this.settings.colors.primaryGraph);
    container.style.setProperty('--secondary-series-color', this.settings.colors.secondaryGraph);

    const graph = document.createElement('div');
    graph.style.position = 'relative';
    graph.appendChild(this.frameCanvas.elem);
    graph.addEventListener('click', () => this.toggleConfiguration(false));
    container.appendChild(graph);

    const noData = document.createElement('div');
    noData.classList.add(styles.noDataText);
    noData.innerText = 'No data yet -- start a debug session to collect some!';
    container.appendChild(noData);

    const labelList = document.createElement('div');
    labelList.classList.add(styles.labelList);
    labelList.style.height = `${Sizing.LabelHeight}px`;
    labelList.addEventListener('click', () => this.toggleConfiguration(true));
    container.appendChild(labelList);

    const leftTime = document.createElement('div');
    leftTime.classList.add(styles.timeLeft);
    graph.appendChild(leftTime);

    const rightTime = document.createElement('div');
    rightTime.innerText = 'now';
    rightTime.classList.add(styles.timeRight);
    graph.appendChild(rightTime);

    const valueContainer = document.createElement('div');
    valueContainer.classList.add(styles.maxContainer);
    graph.appendChild(valueContainer);

    this.setSeries(labelList, valueContainer);

    return { container, labelList, leftTime, valueContainer };
  }

  private toggleConfiguration(toState = !this.configOpen) {
    if (toState === this.configOpen) {
      return;
    }

    this.configHadManualToggle = true;
    this.setConfiguratorOpen(toState);
    this.updateSize(this.width, this.height);
  }

  private applySettings() {
    const { leftTime, labelList, valueContainer } = this.elements;
    leftTime.innerText = `${Math.round(this.settings.value.viewDuration / 1000)}s ago`;
    this.setSeries(labelList, valueContainer);
  }

  private setSeries(labelList: HTMLElement, maxContainer: HTMLElement) {
    for (const [, { max, val }] of this.valElements) {
      max.parentElement?.removeChild(max);
      val.parentElement?.removeChild(val);
    }

    maxContainer.classList[this.settings.value.splitCharts ? 'add' : 'remove'](styles.split);
    labelList.innerHTML = '';
    this.valElements = [];

    for (let i = 0; i < this.settings.enabledMetrics.length; i++) {
      const metric = this.settings.enabledMetrics[i];
      const label = document.createElement('span');
      label.style.setProperty('--metric-color', this.settings.metricColor(metric));
      label.classList.add(styles.primary);
      label.innerText = `${metric.name()}: `;
      labelList.appendChild(label);

      const val = document.createElement('span');
      val.innerText = metric.format(metric.current);
      label.appendChild(val);

      const max = document.createElement('div');
      max.classList.add(styles.max, styles.primary);
      max.innerText = metric.format(metric.maxY);
      max.style.top = `${(i / this.settings.enabledMetrics.length) * 100}%`;
      maxContainer.appendChild(max);

      this.valElements.push([metric, { max, val }]);
    }
  }
}
