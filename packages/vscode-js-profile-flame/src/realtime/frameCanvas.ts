/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Canvas } from './canvas';
import { GraphCanvas } from './graphCanvas';

export const enum Sizing {
  LabelHeight = 18,
  RulerWidth = 1,
  Easing = 200,
}

export class FrameCanvas extends Canvas {
  private ease?: { raf: number; dx: number };
  private rmSettingListener = this.settings.onChange(() => this.redraw());

  /**
   * Redraws the max values
   */
  public updateMetrics(graphCanvas: GraphCanvas, shouldEase = this.settings.value.easing) {
    const { width: w, height: h } = this;

    let easeLength = graphCanvas.stepWidth;
    if (this.ease) {
      cancelAnimationFrame(this.ease.raf);
      easeLength += this.ease.dx;
    }

    if (!shouldEase) {
      this.drawGraph(graphCanvas, w, h);
      return;
    }

    let start: number;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - start) / Sizing.Easing);
      const dx = easeLength * (1 - progress);
      this.drawGraph(graphCanvas, w, h, dx);

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

  protected drawGraph(graphCanvas: GraphCanvas, w: number, h: number, dx = 0) {
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(
      graphCanvas.ctx.canvas,
      graphCanvas.width - w - dx,
      0,
      w * this.scale,
      h * this.scale,
      0,
      0,
      w,
      h,
    );
  }
}
