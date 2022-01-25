/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { INode } from '../common/model';
import { IAnnotationLocation, IJsDebugAnnotations } from '../common/types';
import { getBestLocation } from '../getBestLocation';
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

export interface IHeapProfileRaw extends Cdp.HeapProfiler.SamplingHeapProfile {
  $vscode?: IJsDebugAnnotations;
  head: IProfileModelNode;
}

export interface IProfileModelNode
  extends Omit<Cdp.HeapProfiler.SamplingHeapProfileNode, 'children'> {
  src?: ISourceLocation;
  children: IProfileModelNode[];
  locationId?: number;
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
 * Ensures that all profile nodes have a location ID, setting them if they
 * aren't provided by default.
 */
const ensureSourceLocations = (profile: IHeapProfileRaw): ReadonlyArray<IAnnotationLocation> => {
  if (profile.$vscode) {
    return profile.$vscode.locations; // profiles we generate are already good
  }

  let locationIdCounter = 0;
  const locationsByRef = new Map<
    string,
    { id: number; callFrame: Cdp.Runtime.CallFrame; location: ISourceLocation }
  >();

  const getLocationIdFor = (callFrame: Cdp.Runtime.CallFrame) => {
    const ref = [
      callFrame.functionName,
      callFrame.url,
      callFrame.scriptId,
      callFrame.lineNumber,
      callFrame.columnNumber,
    ].join(':');

    const existing = locationsByRef.get(ref);
    if (existing) {
      return existing.id;
    }
    const id = locationIdCounter++;
    locationsByRef.set(ref, {
      id,
      callFrame,
      location: {
        lineNumber: callFrame.lineNumber,
        columnNumber: callFrame.columnNumber,
        source: {
          name: maybeFileUrlToPath(callFrame.url),
          path: maybeFileUrlToPath(callFrame.url),
          sourceReference: 0,
        },
      },
    });

    return id;
  };

  let nodes = [profile.head];

  while (nodes.length) {
    const node = nodes.pop();

    if (node) {
      const { callFrame } = node;
      node.locationId = getLocationIdFor(callFrame);

      nodes = nodes.concat(node.children);
    }
  }

  return [...locationsByRef.values()]
    .sort((a, b) => a.id - b.id)
    .map(l => ({ locations: [l.location], callFrame: l.callFrame }));
};

/**
 * Computes the model for the given profile.
 */
export const buildModel = (profile: IHeapProfileRaw): IProfileModel => {
  let nodes = [profile.head];

  const sourceLocations = ensureSourceLocations(profile);

  while (nodes.length) {
    const node = nodes.pop();

    if (node) {
      if (node.locationId) {
        node.src = getBestLocation(profile, sourceLocations[node.locationId].locations);
      }
      nodes = nodes.concat(node.children);
    }
  }

  return {
    head: profile.head,
    samples: profile.samples,
    rootPath: profile.$vscode?.rootPath,
  };
};
