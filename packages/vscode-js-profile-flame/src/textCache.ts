/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

interface INode {
  text: string;
  nextOldest?: INode;
  x: number;
  y: number;
  width: number;
  row: number;
}

/**
 * An LRU cache that holds rendered text.
 */
export class TextCache {
  public readonly context: CanvasRenderingContext2D;
  private readonly cached = new Map<string, INode>();
  private oldest?: INode;
  private newest?: INode;
  private rowSize = 20;
  private scale = 1;
  private rows: INode[][] = [];

  /**
   * Gets the height of the text stored in the cache.
   */
  public get textHeight() {
    return this.rowSize;
  }

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = screen.width;
    canvas.height = screen.height;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.context = canvas.getContext('2d')!;
  }

  public setup(scale: number, fn: (ctx: CanvasRenderingContext2D) => void) {
    fn(this.context);
    this.scale = scale;
    this.context.scale(scale, scale);
    this.context.textAlign = 'left';
    this.context.textBaseline = 'top';
    this.rowSize = Math.ceil(this.context.measureText('|').actualBoundingBoxDescent);
    this.rows = [];
    for (let i = 0; i < Math.floor(this.context.canvas.height / this.rowSize / scale); i++) {
      this.rows.push([]);
    }
  }

  /**
   * Draws text at the given position on the canvas.
   */
  public drawText(
    target: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const src = this.cached.get(text);
    h = Math.min(this.rowSize, h);
    if (src) {
      w = Math.min(src.width, w);
      target.drawImage(
        this.context.canvas,
        src.x * this.scale,
        src.y * this.scale,
        w * this.scale,
        h * this.scale,
        x,
        y,
        w,
        h,
      );
      return;
    }

    const totalWidth = Math.ceil(this.context.measureText(text).width);
    const spot = this.allocSpace(totalWidth);
    const node = {
      text,
      nextOldest: this.newest,
      x: spot.x,
      y: spot.y,
      width: totalWidth,
      row: spot.row,
    };

    this.rows[spot.row].splice(spot.column, 0, node);
    this.cached.set(text, node);
    this.newest = node;

    if (this.oldest === undefined) {
      this.oldest = node;
    }

    w = Math.min(totalWidth, w);
    this.context.fillText(text, spot.x, spot.y);
    target.drawImage(
      this.context.canvas,
      spot.x * this.scale,
      spot.y * this.scale,
      w * this.scale,
      h * this.scale,
      x,
      y,
      w,
      h,
    );
  }

  /**
   * Finds a space for text with the given width, returning its position
   * within the rows list.
   */
  private allocSpace(width: number) {
    let start = Math.floor(Math.random() * this.rows.length);
    while (true) {
      for (let yOffset = 0; yOffset < this.rows.length; yOffset++) {
        const y = (start + yOffset) % this.rows.length;
        const len = this.rows[y].length;

        let lastX = 0;
        for (let x = 0; x < len; x++) {
          const node = this.rows[y][x];
          if (node.x - lastX >= width) {
            return { column: x, row: y, x: lastX, y: y * this.rowSize };
          }

          lastX = node.x + node.width;
        }

        if (lastX + width <= this.context.canvas.width || len === 0) {
          return { column: len, row: y, x: lastX, y: y * this.rowSize };
        }
      }

      [, start] = this.pop();
    }
  }

  /**
   * Deallocates the oldest text, returning the [x,y] spot it occupied.
   */
  private pop() {
    if (!this.oldest) {
      return [-1, -1];
    }

    const node = this.oldest;
    this.oldest = node.nextOldest;
    this.cached.delete(node.text);
    this.context.clearRect(node.x, node.y, node.width, this.rowSize);

    if (node === this.newest) {
      this.newest = undefined;
    }

    const row = this.rows[node.row];
    const x = row.indexOf(node);
    row.splice(x, 1);
    return [x, node.y];
  }
}
