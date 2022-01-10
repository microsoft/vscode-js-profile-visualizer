/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { IProfileModel, ITreeNode } from './model';

export class TreeNode implements ITreeNode {
  public static root() {
    return new TreeNode({
      id: -1,
      selfSize: 0,
      children: [],
      callFrame: {
        functionName: '(root)',
        lineNumber: -1,
        columnNumber: -1,
        scriptId: '0',
        url: '',
      },
    });
  }

  public children: { [id: number]: TreeNode } = {};
  public totalSize = 0;
  public selfSize = 0;
  public childrenSize = 0;

  public get id() {
    return this.node.id;
  }

  public get callFrame() {
    return this.node.callFrame;
  }

  constructor(
    public readonly node: Cdp.HeapProfiler.SamplingHeapProfileNode,
    public readonly parent?: TreeNode,
  ) {}

  public toJSON(): ITreeNode {
    return {
      children: this.children,
      childrenSize: this.childrenSize,
      selfSize: this.selfSize,
      totalSize: this.totalSize,
      id: this.id,
      callFrame: this.callFrame,
    };
  }
}

const processNode = (node: Cdp.HeapProfiler.SamplingHeapProfileNode, parent: TreeNode) => {
  const treeNode = new TreeNode(node, parent);

  node.children.forEach(child => {
    const childTreeNode = processNode(child, treeNode);

    treeNode.children[childTreeNode.id] = childTreeNode;
    treeNode.childrenSize++;
  });

  treeNode.selfSize = node.selfSize;
  treeNode.totalSize = node.selfSize;

  for (const child in treeNode.children) {
    treeNode.totalSize += treeNode.children[child].totalSize;
  }

  return treeNode;
};

/**
 * Creates a bottom-up graph of the process information
 */
export const createTree = (model: IProfileModel) => {
  const root = TreeNode.root();

  for (const node of model.head.children) {
    const child = processNode(node, root);
    root.children[child.id] = child;
    root.childrenSize++;
  }

  for (const child in root.children) {
    root.totalSize += root.children[child].totalSize;
  }

  return root;
};
