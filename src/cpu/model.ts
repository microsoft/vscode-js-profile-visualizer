/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { ICpuProfileRaw, ISourceLocation } from './types';
import { properRelative } from '../common/pathUtils';

/**
 * One measured node in the call stack. Contains the time it spent in itself,
 * the time all its children took, references to its children, and finally
 * the ID of its location in the {@link IProfileModel.locations} array.
 */
export interface IComputedNode {
  selfTime: number;
  aggregateTime: number;
  children: number[];
  locationId: number;
}

/**
 * One location in the source. Multiple nodes can reference a single location.
 */
export interface ILocation {
  selfTime: number;
  aggregateTime: number;
  callFrame: Cdp.Runtime.CallFrame;
  src?: ISourceLocation & { relativePath?: string };
}

/**
 * Data model for the profile.
 *
 * Note that source locations and notes are seprate. This is needed because
 * children in the profile  are unique per the calls stack that invoked them,
 * so the same source location will have multiple different nodes in the model.
 */
export interface IProfileModel {
  nodes: ReadonlyArray<IComputedNode>;
  locations: ReadonlyArray<ILocation>;
  rootPath?: string;
  duration: number;
}

/**
 * Recursive function that computes and caches the aggregate time for the
 * children of the computed now.
 */
const computeAggregateTime = (index: number, nodes: IComputedNode[]): number => {
  const row = nodes[index];
  if (row.aggregateTime) {
    return row.aggregateTime;
  }

  let total = row.selfTime;
  for (const child of row.children) {
    total += computeAggregateTime(child, nodes);
  }

  return (row.aggregateTime = total);
};

const getBestLocation = (profile: ICpuProfileRaw, candidates?: ReadonlyArray<ISourceLocation>) => {
  const onDisk = candidates?.find(c => c.source.path && c.source.sourceReference === 0);
  if (!onDisk) {
    return candidates?.[0];
  }

  let relativePath: string | undefined;
  if (profile.$vscode?.rootPath) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    relativePath = properRelative(profile.$vscode.rootPath, onDisk.source.path!);
  }

  return { ...onDisk, relativePath };
};

/**
 * Computes the model for the given profile.
 */
export const buildModel = (profile: ICpuProfileRaw): IProfileModel => {
  if (!profile.timeDeltas || !profile.samples) {
    return {
      nodes: [],
      locations: [],
      rootPath: profile.$vscode?.rootPath,
      duration: profile.endTime - profile.startTime,
    };
  }

  // 1. Created a sorted list of nodes. It seems that the profile always has
  // incrementing IDs, although they are just not initially sorted.
  const nodes = new Array<IComputedNode>(profile.nodes.length);
  const locationsByRef = new Map<string, ILocation & { id: number }>();
  let locationIdCounter = 0;

  for (let i = 0; i < profile.nodes.length; i++) {
    const node = profile.nodes[i];
    const locationRef = [
      node.callFrame.functionName,
      node.callFrame.url,
      node.callFrame.scriptId,
      node.callFrame.lineNumber,
      node.callFrame.columnNumber,
    ].join(':');

    let locationId: number;
    if (locationsByRef.has(locationRef)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      locationId = locationsByRef.get(locationRef)!.id;
    } else {
      locationId = locationIdCounter++;
      locationsByRef.set(locationRef, {
        id: locationId,
        selfTime: 0,
        aggregateTime: 0,
        callFrame: node.callFrame,
        src: getBestLocation(profile, profile.$vscode?.locations?.[i] || undefined),
      });
    }

    // make them 0-based:
    nodes[node.id - 1] = {
      selfTime: 0,
      aggregateTime: 0,
      locationId,
      children: node.children?.map(n => n - 1) || [],
    };
  }

  // 2. The profile samples are the 'bottom-most' node, the currently running
  // code. Sum of these in the self time.
  for (let i = 1; i < profile.timeDeltas.length; i++) {
    nodes[profile.samples[i] - 1].selfTime += profile.timeDeltas[i - 1];
  }

  // 3. Add the aggregate times for all node children and locations
  const locations = [...locationsByRef.values()].sort((a, b) => a.id - b.id);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const location = locations[node.locationId];
    location.aggregateTime += computeAggregateTime(i, nodes);
    location.selfTime += node.selfTime;
  }

  return {
    nodes,
    locations,
    rootPath: profile.$vscode?.rootPath,
    duration: profile.endTime - profile.startTime,
  };
};
