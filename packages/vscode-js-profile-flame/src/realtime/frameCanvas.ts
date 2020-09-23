/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Metric } from './baseMetric';
import { Canvas } from './canvas';

export const enum Sizing {
  LabelHeight = 18,
  RulerWidth = 1,
  Easing = 200,
}

const rulers = 4;

export class FrameCanvas extends Canvas {
  private rulers = this.createRulers();
  private paths: [Path2D, string][] = [];
  private ease?: { raf: number; dx: number };
  private rmSettingListener = this.settings.onChange(() => this.redraw());

  /**
   * Redraws the max values
   */
  public updateMetrics(shouldEase = this.settings.value.easing) {
    let easeLength = this.width / this.settings.steps;
    if (this.ease) {
      cancelAnimationFrame(this.ease.raf);
      easeLength += this.ease.dx;
    }

    this.paths = this.settings.enabledMetrics.map(metric => [
      this.createMetricPath(metric),
      this.settings.metricColor(metric),
    ]);

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

  private createMetricPath({ maxY, metrics }: Metric) {
    const { width, height } = this;
    const stepSize = width / this.settings.steps;
    const path = new Path2D();

    if (metrics.length === 0) {
      path.moveTo(0, height - 1);
      path.lineTo(width, height - 1);
      return path;
    }

    let x = width;
    path.moveTo(x, height * (1 - metrics[metrics.length - 1] / maxY));

    for (let i = metrics.length - 2; i >= 0; i--) {
      x -= stepSize;
      path.lineTo(x, height * (1 - metrics[i] / maxY));
    }

    path.lineTo(x - stepSize, height - 1);
    path.lineTo(-stepSize, height - 1);
    path.lineTo(-stepSize, height + 2);
    path.lineTo(width, height + 2);
    return path;
  }
}
