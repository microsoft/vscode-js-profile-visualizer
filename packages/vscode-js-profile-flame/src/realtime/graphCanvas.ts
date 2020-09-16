/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Metric } from './baseMetric';
import { Canvas } from './canvas';
import { Sizing } from './frameCanvas';

const rulers = 4;

export class GraphCanvas extends Canvas {
  private rulers = this.createRulers();
  public stepWidth = 100;

  /**
   * @override
   */
  public updateSize(width: number, height: number) {
    this.stepWidth = width / this.settings.steps;
    super.updateSize(width + Math.ceil((3 * width) / this.settings.steps), height);
  }

  public updateMetrics() {
    const paths = this.settings.enabledMetrics.map(
      metric => [this.createPath(metric), this.settings.metricColor(metric)] as const,
    );

    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = this.settings.colors.background;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // draw the background rulers first
    this.ctx.strokeStyle = this.settings.colors.border;
    this.ctx.stroke(this.rulers);

    // then the chart fill first (so lines will always be in the foreground)
    this.ctx.globalAlpha = 0.1;
    for (const [path, color] of paths) {
      this.ctx.fillStyle = color;
      this.ctx.fill(path);
    }

    // then stroke the lines
    this.ctx.globalAlpha = 1;
    for (const [path, color] of paths) {
      this.ctx.strokeStyle = color;
      this.ctx.stroke(path);
    }
  }

  /**
   * @override
   */
  protected redraw() {
    this.rulers = this.createRulers();
    this.updateMetrics();
  }

  private createRulers() {
    const path = new Path2D();
    const { width, height } = this;
    const step = (height - Sizing.RulerWidth) / rulers;

    let y = step;
    for (let i = 0; i < rulers; i++) {
      const targetY = Math.floor(y) + Sizing.RulerWidth / 2;
      path.moveTo(0, targetY);
      path.lineTo(width, targetY);
      y += step;
    }

    return path;
  }

  private createPath({ max, metrics }: Metric) {
    const { width, height, stepWidth } = this;
    const path = new Path2D();

    if (metrics.length === 0) {
      path.moveTo(0, height - 1);
      path.lineTo(width, height - 1);
      return path;
    }

    let x = width;
    path.moveTo(x, height * (1 - metrics[metrics.length - 1] / max));

    for (let i = metrics.length - 2; i >= 0; i--) {
      x -= stepWidth;
      path.lineTo(x, height * (1 - metrics[i] / max));
    }

    path.lineTo(x - stepWidth, height - 1);
    path.lineTo(0, height - 1);
    path.lineTo(0, height + 2);
    path.lineTo(width, height + 2);
    return path;
  }
}
