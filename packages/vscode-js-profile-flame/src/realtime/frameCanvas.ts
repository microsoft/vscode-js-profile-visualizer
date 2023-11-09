/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Metric } from './baseMetric';
import { Canvas } from './canvas';
import { Settings } from './settings';

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */

export const enum Sizing {
  LabelHeight = 18,
  RulerWidth = 1,
  LineWidth = 1,
  Easing = 200,
  SplitSpacing = 3,
}

const rulers = 4;

export class FrameCanvas extends Canvas {
  private rulers = this.createRulers();
  private paths: [Path2D, string][] = [];
  private ease?: { raf: number; dx: number };
  private rmSettingListener = this.settings.onChange(() => this.redraw());
  private metricRanges = this.getMetricYRanges();

  public hoveredIndex?: number;
  public onHoverIndex: () => void = () => undefined;

  constructor(width: number, height: number, settings: Settings) {
    super(width, height, settings);

    this.elem.addEventListener('mousemove', evt => this.onMouseMove(evt.pageX));
    this.elem.addEventListener('mouseout', () => this.clearHover());
    window.addEventListener('mouseout', () => this.clearHover());
  }

  /**
   * Redraws the max values
   */
  public updateMetrics(shouldEase = this.settings.value.easing) {
    let easeLength = this.width / this.settings.steps;
    if (this.ease) {
      cancelAnimationFrame(this.ease.raf);
      easeLength += this.ease.dx;
    }

    this.paths = this.createMetricPaths();

    if (!shouldEase) {
      this.drawGraph();
      return;
    }

    let start: number;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - start) / Sizing.Easing);
      const dx = easeLength * (1 - progress);
      this.drawGraph(dx);

      if (progress === 1) {
        this.ease = undefined;
      } else {
        ease.dx = dx;
        ease.raf = requestAnimationFrame(draw);
      }
    };

    const ease = {
      dx: easeLength,
      raf: requestAnimationFrame(now => {
        start = now;
        draw(now);
      }),
    };

    this.ease = ease;
  }

  public dispose() {
    super.dispose();
    this.rmSettingListener();
    if (this.ease) {
      cancelAnimationFrame(this.ease.raf);
    }
  }

  protected redraw() {
    this.rulers = this.createRulers();
    this.metricRanges = this.getMetricYRanges();
    this.updateMetrics(false);
  }

  protected drawGraph(dx = 0) {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // draw the background rulers first
    this.ctx.globalAlpha = 1;
    this.ctx.strokeStyle = this.settings.colors.border;
    this.ctx.stroke(this.rulers);

    this.ctx.save();
    this.ctx.translate(dx, 0);

    if (this.hoveredIndex && this.settings.enabledMetrics.length) {
      const stepSize = this.width / this.settings.steps;
      const x = this.width - (this.settings.enabledMetrics[0].index - this.hoveredIndex) * stepSize;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // then the chart fill first (so lines will always be in the foreground)
    this.ctx.globalAlpha = 0.1;
    for (const [path, color] of this.paths) {
      this.ctx.fillStyle = color;
      this.ctx.fill(path);
    }

    // then stroke the lines
    this.ctx.globalAlpha = 1;
    for (const [path, color] of this.paths) {
      this.ctx.strokeStyle = color;
      this.ctx.stroke(path);
    }

    this.ctx.restore();
  }

  private clearHover() {
    if (this.hoveredIndex === undefined) {
      return;
    }

    this.hoveredIndex = undefined;
    this.onHoverIndex();

    if (!this.ease) {
      this.drawGraph(0); // otherwise it'll draw on the next animation frame
    }
  }

  private onMouseMove(x: number) {
    const { steps, enabledMetrics } = this.settings;
    if (!enabledMetrics.length) {
      return;
    }

    const index = Math.max(0, enabledMetrics[0].index - Math.round((1 - x / this.width) * steps));
    if (index === this.hoveredIndex) {
      return;
    }

    this.hoveredIndex = index;
    this.onHoverIndex();

    if (!this.ease) {
      this.drawGraph(0); // otherwise it'll draw on the next animation frame
    }
  }

  private createRulers() {
    const path = new Path2D();

    const ranges = this.settings.value.splitCharts ? this.getMetricYRanges() : [[0, this.height]];
    for (const [y1, y2] of ranges) {
      const step = (y2 - y1) / rulers;
      let y = y1 + step;
      for (let i = 0; i < rulers; i++) {
        const targetY = Math.floor(y) - Sizing.RulerWidth / 2;
        path.moveTo(0, targetY);
        path.lineTo(this.width, targetY);
        y += step;
      }
    }

    return path;
  }

  private getMetricYRanges(): [number, number][] {
    const metrics = this.settings.enabledMetrics;
    if (!this.settings.value.splitCharts) {
      return metrics.map(() => [0, this.height]);
    }

    const yStep = this.height / metrics.length;
    return metrics.map((_, i) => [
      Math.ceil(yStep * i + (i > 0 ? Sizing.SplitSpacing / 2 : 0)),
      Math.floor(yStep * (i + 1) - (i < metrics.length - 1 ? Sizing.SplitSpacing / 2 : 0)),
    ]);
  }

  private createMetricPaths(): [Path2D, string][] {
    return this.settings.enabledMetrics.map((metric, i) => [
      this.createMetricPath(metric, this.metricRanges[i][0], this.metricRanges[i][1]),
      this.settings.metricColor(metric),
    ]);
  }

  private createMetricPath({ maxY, metrics }: Metric, y1: number, y2: number) {
    const width = this.width;
    const lineBaseY = y2 - Sizing.LineWidth / 2;
    const stepSize = width / this.settings.steps;
    const path = new Path2D();

    if (metrics.length === 0) {
      path.moveTo(0, lineBaseY);
      path.lineTo(width, lineBaseY);
      return path;
    }

    let x = width;
    path.moveTo(x, getY(y1, lineBaseY, 1 - metrics[metrics.length - 1] / maxY));

    for (let i = metrics.length - 2; i >= 0; i--) {
      x -= stepSize;
      path.lineTo(x, getY(y1, lineBaseY, 1 - metrics[i] / maxY));
    }

    path.lineTo(x - stepSize, lineBaseY);
    path.lineTo(-stepSize, lineBaseY);
    path.lineTo(width, lineBaseY);
    return path;
  }
}

const getY = (y1: number, y2: number, value: number) =>
  y1 + (y2 - y1) * Math.max(0, Math.min(1, value));
