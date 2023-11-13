/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import type { WasmSortBy } from '@vscode/v8-heap-parser';

/** Mirrored into this file to avoid concrete dependencies on the wasm bundle from the webview */
export const enum EdgeType {
  Context = 0,
  Element = 1,
  Property = 2,
  Internal = 3,
  Hidden = 4,
  Shortcut = 5,
  Weak = 6,
  Invisible = 7,
  Other = 8,
}

/** Mirrored into this file to avoid concrete dependencies on the wasm bundle from the webview */
export const enum NodeType {
  Hidden = 0,
  Array = 1,
  String = 2,
  Object = 3,
  Code = 4,
  Closure = 5,
  RegExp = 6,
  Number = 7,
  Native = 8,
  Syntheic = 9,
  ConcatString = 10,
  SliceString = 11,
  BigInt = 12,
  Other = 13,
}

export interface IClassGroup {
  name: string;
  index: number;
  childrenLen: number;
  retainedSize: number;
  selfSize: number;
}

export interface INode {
  name: string;
  id: number;
  index: number;
  retainedSize: number;
  selfSize: number;
  childrenLen: number;
  type: NodeType;
}

export interface IRetainingNode {
  name: string;
  id: number;
  index: number;
  retainedSize: number;
  selfSize: number;
  childrenLen: number;
  type: NodeType;
  edgeType: EdgeType;
  retainsIndex: number;
}

export type GraphRPCInterface = {
  getClassGroups(start: number, end: number): Promise<IClassGroup[]>;

  getClassChildren(
    classIndex: number,
    start: number,
    end: number,
    sortBy: WasmSortBy,
  ): Promise<INode[]>;

  getNodeChildren(
    parentIndex: number,
    start: number,
    end: number,
    sortBy: WasmSortBy,
  ): Promise<INode[]>;

  getRetainers(parentIndex: number, maxDistance: number): Promise<IRetainingNode[]>;
};

export type GraphRPCMethods = keyof GraphRPCInterface;

export type GraphRPCCall<K extends GraphRPCMethods = GraphRPCMethods> = {
  id: number;
  args: GraphRPCInterface[K] extends (...args: infer A) => unknown ? A : never;
  method: K;
};

export type GraphRPCResult<K extends GraphRPCMethods = GraphRPCMethods> = {
  id: number;
  result:
    | { ok: GraphRPCInterface[K] extends (...args: unknown[]) => infer R ? R : never }
    | { err: string };
};
