/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Settings } from './settings';

const dpr = window.devicePixelRatio || 1;

/**
 * Wrapper around the canvas that manages scaling and DPI adjustment.
 */
export class Canvas {
  public readonly elem = document.createElement('canvas');
  public readonly ctx = this.elem.getContext('2d') as CanvasRenderingContext2D;
  protected scale = 1;

  constructor(
    public width: number,
    public height: number,
    protected readonly settings: Settings,
  ) {
    this.updateSize(width, height, true);
  }

  /**
   * Disposes unmanaged resources.
   */
  public dispose() {
    // no-op
  }

  /**
   * Updates the canvas dimensions.
   */
  public updateSize(width: number, height: number, force = false) {
    if (!force && width === this.width && height === this.height) {
      return;
    }

    this.width = width;
    this.height = height;
    this.applySizing();
  }

  /**
   * Updates the canvas zoom level.
   */
  public applySizing() {
    const { ctx } = this;

    const effectiveZoom = (this.scale = dpr);
    ctx.canvas.width = this.width * effectiveZoom;
    ctx.canvas.height = this.height * effectiveZoom;
    ctx.canvas.style.width = `${this.width}px`;
    ctx.canvas.style.height = `${this.height}px`;
    ctx.resetTransform();
    ctx.scale(effectiveZoom, effectiveZoom);
    this.redraw();
  }

  /**
   * Called when a size or zoom level change happens.
   */
  protected redraw(): void {
    // no-op
  }
}
