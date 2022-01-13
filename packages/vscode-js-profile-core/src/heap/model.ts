/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { INode } from '../common/model';

export interface IHeapProfileNode extends INode {
  selfSize: number;
  totalSize: number;
}

export interface ITreeNode extends IHeapProfileNode {
  children: { [id: number]: ITreeNode };
  childrenSize: number;
  parent?: ITreeNode;
}

/**
 * Extra annotations added by js-debug.
 */
export interface IJsDebugAnnotations {
  /**
   * Workspace root path, if set.
   */
  rootPath?: string;
}

export interface IHeapProfileRaw extends Cdp.HeapProfiler.SamplingHeapProfile {
  $vscode?: IJsDebugAnnotations;
}

/**
 * Data model for the profile.
 */
export type IProfileModel = Cdp.HeapProfiler.SamplingHeapProfile & {
  rootPath?: string;
};

/**
 * Computes the model for the given profile.
 */
export const buildModel = (profile: IHeapProfileRaw): IProfileModel => {
  return {
    head: profile.head,
    samples: profile.samples,
    rootPath: profile.$vscode?.rootPath,
  };
};
