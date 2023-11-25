/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Category } from '../common/model';
import { IComputedNode, IGraphNode, ILocation, IProfileModel } from './model';

export class BottomUpNode implements IGraphNode {
  public static root() {
    return new BottomUpNode({
      id: -1,
      category: Category.System,
      selfTime: 0,
      aggregateTime: 0,
      ticks: 0,
      callFrame: {
        functionName: '(root)',
        lineNumber: -1,
        columnNumber: -1,
        scriptId: '0',
        url: '',
      },
    });
  }

  public children: { [id: number]: BottomUpNode } = {};
  public aggregateTime = 0;
  public selfTime = 0;
  public ticks = 0;
  public childrenSize = 0;

  public get id() {
    return this.location.id;
  }

  public get callFrame() {
    return this.location.callFrame;
  }

  public get src() {
    return this.location.src;
  }

  public get category() {
    return this.location.category;
  }

  constructor(
    public readonly location: ILocation,
    public readonly parent?: BottomUpNode,
  ) {}

  public addNode(node: IComputedNode) {
    this.selfTime += node.selfTime;
    this.aggregateTime += node.aggregateTime;
  }

  public toJSON(): IGraphNode {
    return {
      children: this.children,
      childrenSize: this.childrenSize,
      aggregateTime: this.aggregateTime,
      selfTime: this.selfTime,
      ticks: this.ticks,
      id: this.id,
      category: this.category,
      callFrame: this.callFrame,
    };
  }
}

const processNode = (
  aggregate: BottomUpNode,
  node: IComputedNode,
  model: IProfileModel,
  initialNode = node,
) => {
  let child = aggregate.children[node.locationId];
  const location = model.locations[node.locationId]; // should always be defined
  if (!child && location) {
    child = new BottomUpNode(location, aggregate);
    aggregate.childrenSize++;
    aggregate.children[node.locationId] = child;
  }
  if (!child) return;

  child.addNode(initialNode);

  if (node.parent) {
    const parent = model.nodes[node.parent];
    if (parent) processNode(child, parent, model, initialNode);
  }
};

/**
 * Creates a bottom-up graph of the process information
 */
export const createBottomUpGraph = (model: IProfileModel) => {
  const root = BottomUpNode.root();

  for (const node of model.nodes) {
    processNode(root, node, model);
    root.addNode(node);
  }

  return root;
};
