/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as Gear from 'vscode-codicons/src/icons/gear.svg';
import { Metric } from './baseMetric';
import styles from './chart.css';
import { Configurator } from './configurator';
import { FrameCanvas, Sizing } from './frameCanvas';
import { GraphCanvas } from './graphCanvas';
import { Settings } from './settings';

const naturalAspectRatio = 16 / 9;
const autoOpenAspectRatio = 4 / 3;
const autoCloseAspectRatio = (naturalAspectRatio + autoOpenAspectRatio) / 2;

const openToSideWidth = 250;
const openToSideMinSpace = 600;

export class Chart {
  private valElements: [Metric, HTMLElement][] = [];
  private configOpen = false;
  private configHadManualToggle = false;

  private readonly frameCanvas = new FrameCanvas(this.width, this.height, this.settings);
  private readonly graphCanvas = new GraphCanvas(this.width, this.height, this.settings);
  private readonly elements = this.createElements();
  private readonly settingListener = this.settings.onChange(() => {
    this.applySettings();
    this.graphCanvas.updateMetrics();
    this.frameCanvas.updateMetrics(this.graphCanvas, false);
  });
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
    this.graphCanvas.dispose();
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
      graphHeight = Math.min(height - Sizing.LabelHeight, Math.round(width / naturalAspectRatio));
      graphWidth = width;
    } else {
      graphHeight = height;
      graphWidth = width - openToSideWidth;
    }

    this.frameCanvas.updateSize(graphWidth, graphHeight);
    this.graphCanvas.updateSize(graphWidth, graphHeight);
    this.frameCanvas.updateMetrics(this.graphCanvas, false);
  }

  /**
   * Update the chart metrics
   */
  public updateMetrics() {
    this.graphCanvas.updateMetrics();
    this.frameCanvas.updateMetrics(this.graphCanvas);

    if (this.configOpen) {
      this.configurator.updateMetrics();
    }

    for (const [metric, el] of this.valElements) {
      el.innerText = metric.format(metric.current);
    }
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
    container.classList.add(styles.container);
    container.style.setProperty('--primary-series-color', this.settings.colors.primaryGraph);
    container.style.setProperty('--secondary-series-color', this.settings.colors.secondaryGraph);

    const graph = document.createElement('div');
    graph.style.position = 'relative';
    graph.appendChild(this.frameCanvas.elem);
    container.appendChild(graph);

    const labelList = document.createElement('div');
    labelList.classList.add(styles.labelList);
    labelList.style.height = `${Sizing.LabelHeight}px`;
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

    const toggleButton = document.createElement('button');
    toggleButton.classList.add(styles.toggle);
    toggleButton.innerHTML = Gear;
    toggleButton.addEventListener('click', () => this.toggleConfiguration());
    graph.appendChild(toggleButton);

    this.setSeries(labelList, valueContainer);

    return { toggleButton, container, labelList, leftTime, valueContainer };
  }

  private toggleConfiguration() {
    this.configHadManualToggle = true;
    this.setConfiguratorOpen(!this.configOpen);
    this.updateSize(this.width, this.height);
  }

  private applySettings() {
    const { leftTime, labelList, valueContainer } = this.elements;
    leftTime.innerText = `${Math.round(this.settings.value.viewDuration / 1000)}s ago`;
    this.setSeries(labelList, valueContainer);
  }

  private setSeries(labelList: HTMLElement, maxContainer: HTMLElement) {
    for (const [, el] of this.valElements) {
      maxContainer.removeChild(el);
    }

    labelList.innerHTML = '';
    this.valElements = [];

    for (const metric of this.settings.enabledMetrics) {
      const label = document.createElement('span');
      label.style.setProperty('--metric-color', this.settings.metricColor(metric));
      label.classList.add(styles.primary);
      label.innerText = metric.name();
      labelList.appendChild(label);

      const val = document.createElement('div');
      val.classList.add(styles.max, styles.primary);
      val.style.setProperty('--metric-color', this.settings.metricColor(metric));
      val.innerText = metric.format(metric.current);

      maxContainer.appendChild(val);
      this.valElements.push([metric, val]);
    }
  }
}
