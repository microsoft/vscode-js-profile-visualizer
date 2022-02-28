/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { Category } from 'vscode-js-profile-core/out/esm/common/model';
import { ILocation, IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import { ISourceLocation } from 'vscode-js-profile-core/out/esm/location-mapping';
import { IColumn, IColumnRow } from '../common/types';

const enum Constants {
  GcFunction = '(garbage collector)',
}

/**
 * Accessor for querying columns in the flame graph.
 */
export class LocationAccessor implements ILocation {
  public readonly id: number;
  public readonly selfTime: number;
  public readonly aggregateTime: number;
  public readonly ticks: number;
  public readonly category: Category;
  public readonly callFrame: Cdp.Runtime.CallFrame;
  public readonly src?: ISourceLocation;

  /**
   * Gets children of the location.
   */
  public get children() {
    const children: LocationAccessor[] = [];
    let dx = this.x;

    // Scan through all columns the cell at this accessor spans. Add their
    // children to the ones we'll return.
    do {
      const rs = this.model[dx].rows[this.y + 1];
      if (rs && typeof rs !== 'number') {
        children.push(new LocationAccessor(this.model, dx, this.y + 1));
      }
    } while (++dx < this.model.length && this.model[dx].rows[this.y] === this.x);

    return children;
  }

  /**
   * Gets root-level accessors for the list of columns.
   */
  public static rootAccessors(columns: ReadonlyArray<IColumn>) {
    const accessors: LocationAccessor[] = [];
    for (let x = 0; x < columns.length; x++) {
      if (typeof columns[x].rows[0] === 'object') {
        accessors.push(new LocationAccessor(columns, x, 0));
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
    accessors: ReadonlySet<LocationAccessor>,
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
    this.selfTime = (cell as ILocation).selfTime;
    this.aggregateTime = (cell as ILocation).aggregateTime;
    this.ticks = (cell as ILocation).ticks;
    this.category = cell.category;
    this.callFrame = cell.callFrame;
    this.src = cell.src;
  }
}

interface ITopDownGraphNode {
  location: ILocation;
  aggregateTime: number;
  selfTime: number;
  children: Map<number, ITopDownGraphNode>;
}

const createTopDownGraph = (model: IProfileModel) => {
  const graph: ITopDownGraphNode = {
    children: new Map(),
    location: null as unknown as ILocation,
    aggregateTime: 0,
    selfTime: 0,
  };

  for (let i = 1; i < model.samples.length - 1; i++) {
    const root = model.nodes[model.samples[i]];
    const selfTime = model.timeDeltas[i - 1];
    const locations = [root.locationId];
    for (let id = root.parent; id; id = model.nodes[id].parent) {
      locations.unshift(model.nodes[id].locationId);
    }

    let node = graph;
    for (const location of locations) {
      node.aggregateTime += selfTime;

      let next = node.children.get(location);
      if (!next) {
        next = {
          children: new Map(),
          aggregateTime: 0,
          selfTime: 0,
          location: model.locations[location],
        };
        node.children.set(location, next);
      }

      node = next;
    }

    node.selfTime += selfTime;
  }

  return graph.children;
};

export const buildLeftHeavyColumns = (model: IProfileModel): IColumn[] => {
  const graph = createTopDownGraph(model);

  const columns: IColumn[] = [];

  let x = 0;
  let graphIdCounter = 0;
  const addSelf = (node: ITopDownGraphNode, rows: ILocation[]) => {
    const x1 = x;
    x += node.selfTime / model.duration;
    columns.push({
      x1,
      x2: x,
      rows: [
        ...rows.map(row => ({
          ...row,
          graphId: graphIdCounter++,
          aggregateTime: node.selfTime,
          selfTime: 0,
        })),
        { ...node.location, graphId: graphIdCounter++, selfTime: node.selfTime, aggregateTime: 0 },
      ],
    });
  };

  const build = (node: ITopDownGraphNode, rows: ILocation[]) => {
    let addedSelf = node.selfTime === 0; // add the self time if it's > 0
    const children = [...node.children.values()].sort((a, b) => b.aggregateTime - a.aggregateTime);
    for (const child of children) {
      if (!addedSelf && node.selfTime > child.aggregateTime + child.selfTime) {
        addSelf(node, rows);
        addedSelf = true;
      }

      build(child, [...rows, node.location]);
    }

    if (!addedSelf) {
      addSelf(node, rows);
    }
  };

  for (const child of [...graph.values()].sort((a, b) => b.aggregateTime - a.aggregateTime)) {
    build(child, []);
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
  const columns: IColumn[] = [];
  let graphIdCounter = 0;

  // 1. Build initial columns
  let timeOffset = 0;
  for (let i = 1; i < model.samples.length - 1; i++) {
    const root = model.nodes[model.samples[i]];
    const selfTime = model.timeDeltas[i - 1];
    const rows = [
      {
        ...model.locations[root.locationId],
        graphId: graphIdCounter++,
        selfTime,
        aggregateTime: 0,
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (let id = root.parent; id; id = model.nodes[id!].parent) {
      rows.unshift({
        ...model.locations[model.nodes[id].locationId],
        graphId: graphIdCounter++,
        selfTime: 0,
        aggregateTime: selfTime,
      });
    }

    columns.push({
      x1: timeOffset / model.duration,
      x2: (selfTime + timeOffset) / model.duration,
      rows,
    });
    timeOffset += selfTime;
  }

  mergeColumns(columns);
  return columns;
};

const mergeColumns = (columns: IColumn[]) => {
  let lastFrameWasGc = false;
  for (let x = 1; x < columns.length; x++) {
    const col = columns[x];
    const root = col.rows[0] as IColumnRow;

    // GC has no stack and can interrupt execution. To avoid breaking up flames,
    // show GC on top of the previous frame. Matches what chrome devtools do.
    if (col.rows.length === 1 && x > 0 && root.callFrame.functionName === Constants.GcFunction) {
      col.rows = columns[x - 1].rows.map(row => (typeof row === 'number' ? row : x - 1));
      if (!lastFrameWasGc) {
        col.rows.push(root);
        lastFrameWasGc = true;
      }
      continue;
    }

    lastFrameWasGc = false;
    for (let y = 0; y < col.rows.length; y++) {
      const current = col.rows[y] as IColumnRow;
      const prevOrNumber = columns[x - 1]?.rows[y];
      if (typeof prevOrNumber === 'number') {
        if (current.id !== (columns[prevOrNumber].rows[y] as IColumnRow).id) {
          break;
        }
        col.rows[y] = prevOrNumber;
      } else if (prevOrNumber?.id === current.id) {
        col.rows[y] = x - 1;
      } else {
        break;
      }

      const prev =
        typeof prevOrNumber === 'number'
          ? (columns[prevOrNumber].rows[y] as ILocation)
          : prevOrNumber;
      (prev as ILocation).selfTime += (current as ILocation).selfTime;
      (prev as ILocation).aggregateTime += (current as ILocation).aggregateTime;
    }
  }
};
