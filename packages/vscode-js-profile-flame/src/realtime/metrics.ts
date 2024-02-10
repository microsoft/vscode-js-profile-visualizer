/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DerivativeMetric, Metric } from './baseMetric';
import { IDAMetrics } from './protocol';

const sizeLabels = ['B', 'KB', 'MB', 'GB', 'TB'];

const sizeInnerFormat = new Intl.NumberFormat(undefined, {
  maximumSignificantDigits: 3,
} as Intl.NumberFormatOptions);

const wholeNumberFormat = new Intl.NumberFormat(undefined, {
  notation: 'compact',
} as Intl.NumberFormatOptions);

const formatSize = (bytes: number) => {
  let size = 0;
  while (bytes > 1024 && size < sizeLabels.length) {
    bytes /= 1024;
    size++;
  }

  return `${sizeInnerFormat.format(bytes)} ${sizeLabels[size]}`;
};

// you can't mix sig fix and max fraction digits, so need both to avoid things like 0.0000012%
const largePercentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 2,
});

const smallPercentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 2,
});

const durationRawFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

export const durationFormat = (seconds: number) => {
  if (seconds < 120) {
    return `${durationRawFormat.format(seconds)}s`;
  }

  const minutes = seconds / 60;
  if (minutes < 120) {
    return `${durationRawFormat.format(minutes)}m`;
  }

  const hours = minutes / 60;
  return `${durationRawFormat.format(hours)}h`;
};

export class CpuMetric extends DerivativeMetric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.cpu /* node */) {
      this.push(timestamp, metrics.cpu.user / 1000 / 1000); // microseconds to s
    } else if (metrics.TaskDuration !== undefined /* Chrome */) {
      this.push(timestamp, metrics.TaskDuration / 1000);
    }
  }

  public format(metric: number): string {
    metric = Math.max(0, Math.min(1, metric));
    return metric >= 0.01 ? largePercentFormat.format(metric) : smallPercentFormat.format(metric);
  }

  public name(): string {
    return 'CPU Usage';
  }

  public short(): string {
    return 'CPU';
  }

  protected recalcMax() {
    return 1;
  }
}

export class HeapMetric extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.memory /* node */) {
      this.push(timestamp, metrics.memory.heapUsed);
    } else if (metrics.JSHeapUsedSize !== undefined /* Chrome */) {
      this.push(timestamp, metrics.JSHeapUsedSize);
    }
  }

  public format(metric: number): string {
    return formatSize(metric);
  }

  public short(): string {
    return 'Heap';
  }

  public name(): string {
    return 'Heap Used';
  }
}

export class HeapTotalMetric extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.memory /* node */) {
      this.push(timestamp, metrics.memory.heapTotal);
    }
  }

  public format(metric: number): string {
    return formatSize(metric);
  }

  public short(): string {
    return 'Heap Total';
  }

  public name(): string {
    return 'Heap Total';
  }
}

export class ResidentSetMetric extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.memory /* node */) {
      this.push(timestamp, metrics.memory.rss);
    }
  }

  public format(metric: number): string {
    return formatSize(metric);
  }

  public short(): string {
    return 'RSS';
  }

  public name(): string {
    return 'Resident Set Size';
  }
}

export class ExternalMetric extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.memory /* node */) {
      this.push(timestamp, metrics.memory.external);
    }
  }

  public format(metric: number): string {
    return formatSize(metric);
  }

  public short(): string {
    return 'External';
  }

  public name(): string {
    return 'External Memory';
  }
}

export class ArrayBuffersMetric extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.memory /* node */) {
      this.push(timestamp, metrics.memory.arrayBuffers);
    }
  }

  public format(metric: number): string {
    return formatSize(metric);
  }

  public short(): string {
    return 'ArrayBuffer';
  }

  public name(): string {
    return 'ArrayBuffer Memory';
  }
}

export class DOMNodes extends Metric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.Nodes) {
      this.push(timestamp, metrics.Nodes);
    }
  }

  public format(metric: number): string {
    return wholeNumberFormat.format(metric);
  }

  public short(): string {
    return 'DOM Nodes';
  }

  public name(): string {
    return 'DOM Nodes';
  }
}

export class LayoutCount extends DerivativeMetric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.LayoutCount !== undefined) {
      this.push(timestamp, metrics.LayoutCount / 1000);
    }
  }

  public format(metric: number): string {
    return wholeNumberFormat.format(metric);
  }

  public short(): string {
    return 'Relayouts';
  }

  public name(): string {
    return 'DOM Relayouts / s';
  }
}

export class StyleRecalcs extends DerivativeMetric {
  public update(timestamp: number, metrics: IDAMetrics): void {
    if (metrics.RecalcStyleCount !== undefined) {
      this.push(timestamp, metrics.RecalcStyleCount / 1000);
    }
  }

  public format(metric: number): string {
    return wholeNumberFormat.format(metric);
  }

  public short(): string {
    return 'Restyles';
  }

  public name(): string {
    return 'Style Recalcs / s';
  }
}

export const createMetrics = () => [
  new CpuMetric(),
  new HeapMetric(),
  new HeapTotalMetric(),
  new ResidentSetMetric(),
  new ExternalMetric(),
  new ArrayBuffersMetric(),
  new DOMNodes(),
  new LayoutCount(),
  new StyleRecalcs(),
];
