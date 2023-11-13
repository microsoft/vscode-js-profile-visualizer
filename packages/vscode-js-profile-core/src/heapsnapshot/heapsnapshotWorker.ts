/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Node, RetainerNode } from '@vscode/v8-heap-parser';
import { readFile } from 'fs/promises';
import { parentPort, workerData } from 'worker_threads';
import {
  EdgeType,
  GraphRPCCall,
  GraphRPCMethods,
  IClassGroup,
  INode,
  IRetainingNode,
  NodeType,
} from './rpc';

if (!parentPort) {
  throw new Error('must be run in worker thread');
}

const graph = Promise.all([
  typeof workerData === 'string' ? readFile(workerData) : Promise.resolve(workerData as Uint8Array),
  import('@vscode/v8-heap-parser'),
]).then(async ([f, r]) => {
  const { decode_bytes, init_panic_hook } = await r.default;
  init_panic_hook();
  return decode_bytes(f);
});

export const isMethod = <K extends GraphRPCMethods>(
  method: K,
  t: GraphRPCCall,
): t is GraphRPCCall<K> => t.method === method;

const mapInto = <T extends { free(): void }, R>(
  arr: readonly T[],
  mapper: (v: T, i: number) => R,
): R[] => {
  const transmuted = new Array<R>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    transmuted[i] = mapper(value, i);
    value.free();
  }

  return transmuted;
};

const processNodes = (nodes: readonly (Node | RetainerNode)[]): (INode | IRetainingNode)[] =>
  mapInto(nodes, node => ({
    name: node.name(),
    childrenLen: node.children_len,
    id: node.id,
    index: node.index,
    retainedSize: Number(node.retained_size),
    selfSize: Number(node.self_size),
    type: node.typ as unknown as NodeType,
    retainsIndex: (node as RetainerNode).retains_index,
    edgeType: (node as RetainerNode).edge_typ as unknown as EdgeType,
  }));

parentPort.on('message', (message: GraphRPCCall) => {
  graph
    .then(g => {
      if (isMethod('getClassGroups', message)) {
        return mapInto(
          g.get_class_groups(...message.args, false),
          (group, index): IClassGroup => ({
            name: group.name(),
            index,
            retainedSize: Number(group.retained_size),
            selfSize: Number(group.self_size),
            childrenLen: group.children_len,
          }),
        );
      } else if (isMethod('getClassChildren', message)) {
        return processNodes(g.class_children(...message.args));
      } else if (isMethod('getNodeChildren', message)) {
        return processNodes(g.node_children(...message.args));
      } else if (isMethod('getRetainers', message)) {
        return processNodes(g.get_all_retainers(...message.args));
      } else {
        throw new Error(`unknown method ${message.method}`);
      }
    })
    .then(ok =>
      parentPort!.postMessage({
        id: message.id,
        result: { ok },
      }),
    )
    .catch(err =>
      parentPort!.postMessage({
        id: message.id,
        result: { err: err.stack || err.message || String(err) },
      }),
    );
});
