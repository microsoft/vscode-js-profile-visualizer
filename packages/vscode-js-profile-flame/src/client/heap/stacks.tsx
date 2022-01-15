/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { Category } from 'vscode-js-profile-core/out/esm/common/model';
import {
  IHeapProfileNode,
  IProfileModel,
  ITreeNode,
} from 'vscode-js-profile-core/out/esm/heap/model';
import { createTree } from 'vscode-js-profile-core/out/esm/heap/tree';
import { ISourceLocation } from 'vscode-js-profile-core/out/esm/location-mapping';
import { IColumn, IColumnRow } from '../common/types';

/**
 * Accessor for querying columns in the flame graph.
 */
export class TreeNodeAccessor implements IHeapProfileNode {
  public readonly id: number;
  public readonly selfSize: number;
  public readonly totalSize: number;
  public readonly callFrame: Cdp.Runtime.CallFrame;
  public readonly category: Category;
  public readonly src?: ISourceLocation;

  /**
   * Gets children of the treeNode.
   */
  public get children() {
    const children: TreeNodeAccessor[] = [];
    let dx = this.x;

    // Scan through all columns the cell at this accessor spans. Add their
    // children to the ones we'll return.
    do {
      const rs = this.model[dx].rows[this.y + 1];
      if (rs && typeof rs !== 'number') {
        children.push(new TreeNodeAccessor(this.model, dx, this.y + 1));
      }
    } while (++dx < this.model.length && this.model[dx].rows[this.y] === this.x);

    return children;
  }

  /**
   * Gets root-level accessors for the list of columns.
   */
  public static rootAccessors(columns: ReadonlyArray<IColumn>) {
    const accessors: TreeNodeAccessor[] = [];
    for (let x = 0; x < columns.length; x++) {
      if (typeof columns[x].rows[0] === 'object') {
        accessors.push(new TreeNodeAccessor(columns, x, 0));
      }
    }

    return accessors;
  }

  /**
   * Gets a mapping of the maximum Y values of each column which
   * should be highlighted.
   */
  public static getFilteredColumns(
    columns: ReadonlyArray<IColumn>,
    accessors: ReadonlySet<TreeNodeAccessor>,
  ) {
    const mapping = new Array(columns.length);
    for (const accessor of accessors) {
      mapping[accessor.x] = Math.max(mapping[accessor.x] || 0, accessor.y);
    }

    return mapping;
  }

  constructor(
    private readonly model: ReadonlyArray<IColumn>,
    public readonly x: number,
    public readonly y: number,
  ) {
    const cell = this.model[x].rows[y];
    if (typeof cell === 'number') {
      throw new Error('Cannot create an accessor in a merged location');
    }

    this.id = cell.id;
    this.selfSize = (cell as IHeapProfileNode).selfSize;
    this.totalSize = (cell as IHeapProfileNode).totalSize;
    this.callFrame = (cell as IHeapProfileNode).callFrame;
    this.category = cell.category;
    this.src = cell.src;
  }
}

export const buildLeftHeavyColumns = (model: IProfileModel): IColumn[] => {
  const tree = createTree(model);

  const columns: IColumn[] = [];

  let graphIdCounter = 0;
  const cols: ITreeNode[] = [];

  const getCols = (node: ITreeNode) => {
    for (const key in node.children) {
      if (Object.prototype.hasOwnProperty.call(node.children, key)) {
        const child = node.children[key];
        getCols(child);
      }
    }

    if (node.selfSize) {
      cols.push(node);
    }
  };

  getCols(tree);

  cols.sort((a, b) => b.selfSize - a.selfSize);

  let sizeOffset = 0;
  for (let i = 0; i < cols.length; i++) {
    const root = cols[i];
    const rows = [
      {
        ...root,
        id: root.id,
        callFrame: root.callFrame,
        graphId: graphIdCounter++,
      },
    ];

    for (let node = root.parent; node; node = node.parent) {
      rows.unshift({
        ...node,
        id: node.id,
        callFrame: node.callFrame,
        graphId: graphIdCounter++,
      });
    }

    columns.push({
      x1: sizeOffset / tree.totalSize,
      x2: (root.selfSize + sizeOffset) / tree.totalSize,
      rows,
    });

    sizeOffset += root.selfSize;
  }

  mergeColumns(columns);

  return columns;
};

/**
 * Builds a 2D array of flame graph entries. Returns the columns with nested
 * 'rows'. Each column includes a percentage width (0-1) of the screen space.
 * A number, instead of a node in a column, means it should be merged with
 * the node at the column at the given index.
 */
export const buildColumns = (model: IProfileModel) => {
  const tree = createTree(model);

  const columns: IColumn[] = [];

  let graphIdCounter = 0;
  const cols: ITreeNode[] = [];

  const getCols = (node: ITreeNode) => {
    for (const key in node.children) {
      if (Object.prototype.hasOwnProperty.call(node.children, key)) {
        const child = node.children[key];
        getCols(child);
      }
    }

    if (node.selfSize) {
      cols.push(node);
    }
  };

  getCols(tree);

  let sizeOffset = 0;
  for (let i = 0; i < cols.length; i++) {
    const root = cols[i];
    const rows = [];

    for (let node: ITreeNode | undefined = root; node; node = node.parent) {
      rows.unshift({
        ...node,
        id: node.id,
        callFrame: node.callFrame,
        graphId: graphIdCounter++,
        src: node.src,
      });
    }

    columns.push({
      x1: sizeOffset / tree.totalSize,
      x2: (root.selfSize + sizeOffset) / tree.totalSize,
      rows,
    });

    sizeOffset += root.selfSize;
  }

  mergeColumns(columns);
  return columns;
};

const mergeColumns = (columns: IColumn[]) => {
  for (let x = 1; x < columns.length; x++) {
    const col = columns[x];

    for (let y = 0; y < col.rows.length; y++) {
      const current = col.rows[y] as IColumnRow;
      const prevOrNumber = columns[x - 1]?.rows[y];

      if (prevOrNumber === undefined) {
        break;
      }

      if (typeof prevOrNumber === 'number') {
        if (current.id !== (columns[prevOrNumber].rows[y] as IColumnRow).id) {
          break;
        }
        col.rows[y] = prevOrNumber;
      } else if (prevOrNumber.id === current.id) {
        col.rows[y] = x - 1;
      } else {
        break;
      }
    }
  }
};
