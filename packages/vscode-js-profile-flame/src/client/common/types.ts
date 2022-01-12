/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Category } from 'vscode-js-profile-core/out/esm/common/model';

export interface IBox {
  column: number;
  row: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;
  level: number;
  text: string;
  loc: any;
  category: any;
}

export interface IBounds {
  minX: number;
  maxX: number;
  y: number;
  level: number;
}

export interface ICanvasSize {
  width: number;
  height: number;
}

export interface IColumnRow {
  graphId: number; //. unique ID of the location in the graph
  category: Category;
  callFrame?: any;
  id: number;
  [key: string]: any;
}

export interface IColumn {
  x1: number;
  x2: number;
  rows: (IColumnRow | number)[];
}

export const enum LockBound {
  None = 0,
  Y = 1 << 0,
  MinX = 1 << 1,
  MaxX = 1 << 2,
}

export interface IDrag {
  timestamp: number;
  pageXOrigin: number;
  pageYOrigin: number;
  original: IBounds;
  xPerPixel: number;
  lock: LockBound;
}

export const enum HighlightSource {
  Hover,
  Keyboard,
}
