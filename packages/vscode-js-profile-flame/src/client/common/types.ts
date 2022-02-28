/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILocation } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IHeapProfileNode } from 'vscode-js-profile-core/out/esm/heap/model';

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
  category: number;
  loc: IColumnRow;
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

export type IColumnRow = (ILocation | IHeapProfileNode) & {
  graphId: number; //. unique ID of the location in the graph
};

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
