/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { INode } from '../common/model';
import { ISourceLocation } from '../location-mapping';
import { maybeFileUrlToPath } from '../path';

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

export interface IProfileModelNode
  extends Omit<Cdp.HeapProfiler.SamplingHeapProfileNode, 'children'> {
  src?: ISourceLocation;
  children: IProfileModelNode[];
}

/**
 * Data model for the profile.
 */
export type IProfileModel = {
  head: IProfileModelNode;
  samples: Cdp.HeapProfiler.SamplingHeapProfileSample[];
  rootPath?: string;
};

/**
 * Computes the model for the given profile.
 */
export const buildModel = (profile: IHeapProfileRaw): IProfileModel => {
  let nodes = [profile.head];

  while (nodes.length) {
    const node = nodes.pop();

    if (node) {
      const { callFrame } = node;
      (node as unknown as IHeapProfileNode).src = {
        lineNumber: callFrame.lineNumber,
        columnNumber: callFrame.columnNumber,
        source: {
          name: maybeFileUrlToPath(callFrame.url),
          path: maybeFileUrlToPath(callFrame.url),
          sourceReference: 0,
        },
      };
      nodes = nodes.concat(node.children);
    }
  }

  return {
    head: profile.head,
    samples: profile.samples,
    rootPath: profile.$vscode?.rootPath,
  };
};
