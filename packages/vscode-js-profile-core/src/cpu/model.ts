/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { isDefined } from '../array';
import { categorize, INode } from '../common/model';
import { IAnnotationLocation } from '../common/types';
import { getBestLocation } from '../getBestLocation';
import { ISourceLocation } from '../location-mapping';
import { maybeFileUrlToPath } from '../path';
import { ICpuProfileRaw } from './types';

/**
 * One measured node in the call stack. Contains the time it spent in itself,
 * the time all its children took, references to its children, and finally
 * the ID of its location in the {@link IProfileModel.locations} array.
 */
export interface IComputedNode {
  id: number;
  selfTime: number;
  aggregateTime: number;
  children: number[];
  parent?: number;
  locationId: number;
}

/**
 * One location in the source. Multiple nodes can reference a single location.
 */
export interface ILocation extends INode {
  selfTime: number;
  aggregateTime: number;
  ticks: number;
}

export interface IGraphNode extends ILocation {
  children: { [id: number]: IGraphNode };
  childrenSize: number;
  parent?: IGraphNode;
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
  samples: ReadonlyArray<number>;
  timeDeltas: ReadonlyArray<number>;
  rootPath?: string;
  duration: number;
}

/**
 * Recursive function that computes and caches the aggregate time for the
 * children of the computed now.
 */
const computeAggregateTime = (index: number, nodes: IComputedNode[]): number => {
  const row = nodes[index];
  if (!row) return 0;
  if (row.aggregateTime) {
    return row.aggregateTime;
  }

  let total = row.selfTime;
  for (const child of row.children) {
    total += computeAggregateTime(child, nodes);
  }

  return (row.aggregateTime = total);
};

/**
 * Ensures that all profile nodes have a location ID, setting them if they
 * aren't provided by default.
 */
const ensureSourceLocations = (profile: ICpuProfileRaw): ReadonlyArray<IAnnotationLocation> => {
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
        lineNumber: callFrame.lineNumber + 1,
        columnNumber: callFrame.columnNumber + 1,
        source: {
          name: maybeFileUrlToPath(callFrame.url),
          path: maybeFileUrlToPath(callFrame.url),
          sourceReference: 0,
        },
      },
    });

    return id;
  };

  for (const node of profile.nodes) {
    node.locationId = getLocationIdFor(node.callFrame);
    node.positionTicks = node.positionTicks?.map(tick => ({
      ...tick,
      // weirdly, line numbers here are 1-based, not 0-based. The position tick
      // only gives line-level granularity, so 'mark' the entire range of source
      // code the tick refers to
      startLocationId: getLocationIdFor({
        ...node.callFrame,
        lineNumber: tick.line - 1,
        columnNumber: 0,
      }),
      endLocationId: getLocationIdFor({
        ...node.callFrame,
        lineNumber: tick.line,
        columnNumber: 0,
      }),
    }));
  }

  return [...locationsByRef.values()]
    .sort((a, b) => a.id - b.id)
    .map(l => ({ locations: [l.location], callFrame: l.callFrame }));
};

/**
 * Computes the model for the given profile.
 */
export const buildModel = (profile: ICpuProfileRaw): IProfileModel => {
  if (!profile.timeDeltas || !profile.samples) {
    return {
      nodes: [],
      locations: [],
      samples: profile.samples || [],
      timeDeltas: profile.timeDeltas || [],
      rootPath: profile.$vscode?.rootPath,
      duration: profile.endTime - profile.startTime,
    };
  }

  const { samples, timeDeltas } = profile;
  const sourceLocations = ensureSourceLocations(profile);
  const locations: ILocation[] = sourceLocations.map((l, id) => {
    const src = getBestLocation(profile, l.locations);

    return {
      id,
      selfTime: 0,
      aggregateTime: 0,
      ticks: 0,
      category: categorize(l.callFrame, src),
      callFrame: l.callFrame,
      src,
    };
  });

  const idMap = new Map<number /* id in profile */, number /* incrementing ID */>();
  const mapId = (nodeId: number) => {
    let id = idMap.get(nodeId);
    if (id === undefined) {
      id = idMap.size;
      idMap.set(nodeId, id);
    }

    return id;
  };

  // 1. Created a sorted list of nodes. It seems that the profile always has
  // incrementing IDs, although they are just not initially sorted.
  const nodes = new Array<IComputedNode>(profile.nodes.length);
  for (const node of profile.nodes) {
    // make them 0-based:
    const id = mapId(node.id);
    nodes[id] = {
      id,
      selfTime: 0,
      aggregateTime: 0,
      locationId: node.locationId as number,
      children: node.children?.map(mapId) || [],
    };

    for (const child of node.positionTicks || []) {
      if (child.startLocationId) {
        const childLocation = locations[child.startLocationId];
        if (childLocation) childLocation.ticks += child.ticks;
      }
    }
  }

  for (const node of nodes) {
    for (const childId of node.children) {
      const child = nodes[childId];
      if (child) child.parent = node.id;
    }
  }

  const sampledNode = (i: number) => isDefined(samples[i]) && nodes[mapId(samples[i]!)];

  // 2. The profile samples are the 'bottom-most' node, the currently running
  // code. Sum of these in the self time.
  const duration = profile.endTime - profile.startTime;
  let lastNodeTime = duration - (timeDeltas[0] || 0);
  for (let i = 0; i < timeDeltas.length - 1; i++) {
    const d = timeDeltas[i + 1] || 0;
    const node = sampledNode(i);
    if (node) node.selfTime += d;
    lastNodeTime -= d;
  }

  // Add in an extra time delta for the last sample. `timeDeltas[0]` is the
  // time before the first sample, and the time of the last sample is only
  // derived (approximately) by the missing time in the sum of deltas. Save
  // some work by calculating it here.
  if (nodes.length) {
    const node = sampledNode(timeDeltas.length - 1);
    if (node) node.selfTime += lastNodeTime;
    timeDeltas.push(lastNodeTime);
  }

  // 3. Add the aggregate times for all node children and locations
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const location = node && locations[node.locationId];
    if (location) {
      location.aggregateTime += computeAggregateTime(i, nodes);
      location.selfTime += node.selfTime;
    }
  }

  return {
    nodes,
    locations,
    samples: samples.map(mapId),
    timeDeltas,
    rootPath: profile.$vscode?.rootPath,
    duration,
  };
};
