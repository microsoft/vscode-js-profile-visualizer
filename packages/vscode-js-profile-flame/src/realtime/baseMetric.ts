/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IDAMetrics } from './protocol';

export abstract class Metric {
  private innerMetrics: number[] = [];
  private width = 1;
  private maxMetric = 1;

  /**
   * Index of the most recent metric. Incremented every time new metrics
   * are added.
   */
  public index = 0;

  /**
   * Gets the max y value that the chart should be scaled to. Defaults to
   * get the max-higher power of 2.
   */
  public get maxY() {
    let maxY = 10 ** Math.ceil(Math.log10(this.maxMetric));
    if (maxY > this.maxMetric * 2) {
      maxY /= 2;
    }

    if (maxY > this.maxMetric * 2) {
      maxY /= 2;
    }

    return maxY;
  }

  /**
   * Gets the value at the given index in the data, if it's still retained.
   */
  public valueAt(index: number): number | undefined {
    return this.innerMetrics[this.innerMetrics.length - (this.index - index) - 1];
  }

  /**
   * Gets the metric data. May not be the complete `width` if not enough data
   * is yet available.
   */
  public get metrics(): number[] {
    return this.innerMetrics;
  }

  /**
   * Gets the metric's current value.
   */
  public get current(): number {
    return this.innerMetrics[this.innerMetrics.length - 1] ?? 0;
  }

  /**
   * Resets the number of metric buckets stored.
   */
  public reset(width: number) {
    if (width === this.width) {
      return;
    }

    this.width = width;
    this.maxMetric = 1;
    this.index = 0;
    if (this.innerMetrics.length) {
      this.innerMetrics = [];
    }
  }

  /**
   * Gets whether this metric has any data to report.
   */
  public hasData() {
    return !!this.innerMetrics.length;
  }

  /**
   * Replaces the data in the metric with the given ones.
   */
  public setData(data: number[]) {
    this.innerMetrics = data;
    this.index = data.length;
    this.maxMetric = this.recalcMax();
  }

  /**
   * Called when new data is read from the debugger.
   */
  public abstract update(timestamp: number, metrics: IDAMetrics): void;

  /**
   * Returns the formatted string for the metric.
   */
  public abstract format(metric: number): string;

  /**
   * Returns the name of the metric.
   */
  public abstract name(): string;

  /**
   * Returns a short label for the metric.
   */
  public abstract short(): string;

  /**
   * Adds a new metric to the internal series.
   */
  protected push(_timestamp: number, metric: number) {
    if (this.innerMetrics.length === this.width) {
      if (this.innerMetrics.shift() === this.maxMetric && metric < this.maxMetric) {
        this.maxMetric = this.recalcMax();
      }
    }

    this.maxMetric = Math.max(this.maxMetric, metric);
    this.innerMetrics.push(metric);
    this.index++;
  }

  protected recalcMax() {
    let max = 1;
    for (const metric of this.innerMetrics) {
      max = Math.max(max, metric);
    }

    return max;
  }
}

/**
 * Metric that calculates its values by recording their change per second.
 */
export abstract class DerivativeMetric extends Metric {
  private lastTimeStamp = -1;
  private lastMetric = -1;

  /**
   * @override
   */
  public setData(data: number[]) {
    super.setData(data);
    this.lastTimeStamp = -1;
  }

  /**
   * @override
   */
  protected push(timestamp: number, metric: number) {
    const prevTimestamp = this.lastTimeStamp;
    const prevMetric = this.lastMetric;

    this.lastTimeStamp = timestamp;
    this.lastMetric = metric;

    if (this.lastTimeStamp !== -1) {
      super.push(timestamp, ((metric - prevMetric) / (timestamp - prevTimestamp)) * 1000);
    }
  }
}
