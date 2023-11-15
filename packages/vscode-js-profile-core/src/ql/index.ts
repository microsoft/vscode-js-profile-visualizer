/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { compile, lex } from './parser';
import { Property } from './types';

export * from './types';

type ReadRange<T> = (start: number, end: number, sort?: (a: T, b: T) => number) => Promise<T[]>;

export class DataProvider<T> {
  private data?: T[];
  private _read?: ReadRange<T>;
  private sortFn?: (a: T, b: T) => number;
  private asyncLoads: { upTo: number; p: Promise<readonly T[]> }[] = [];
  private children = new Map<T, DataProvider<T>>();

  /** Gets whether the end of data has been reached. */
  public get eof() {
    return this.data?.length === this.length || Array.isArray(this._read);
  }

  /** Gets the data already loaded */
  public get loaded(): readonly T[] {
    return this.data || [];
  }

  /** Creates a data provider that reads from static arrays. */
  public static fromArray<T>(value: T[], getChildren: (item: T) => T[]): DataProvider<T> {
    return this.fromTopLevelArray(value, v => DataProvider.fromArray(getChildren(v), getChildren));
  }

  /** Creates a data provider that has a static array for the top-level children, and async thereafter. */
  public static fromTopLevelArray<T>(
    value: T[],
    getChildren: (item: T) => DataProvider<T>,
  ): DataProvider<T> {
    const dp = new DataProvider(value.length, () => Promise.resolve(value), getChildren);
    dp.data = value;
    return dp;
  }

  /** Creates a data provider that delegates to the function for reading and writing. */
  public static fromProvider<T>(
    length: number,
    read: ReadRange<T>,
    getChildren: (item: T) => DataProvider<T>,
  ): DataProvider<T> {
    return DataProvider.fromProvider(length, read, getChildren);
  }

  constructor(
    public readonly length: number,
    read: T[] | ReadRange<T>,
    private readonly _getChildren: (item: T) => DataProvider<T>,
  ) {
    if (Array.isArray(read) || read instanceof Array) {
      this.data = read;
    } else {
      this._read = read;
    }
  }

  /** Recursively updates the sorting used for data in the provider. */
  public setSort(sort?: (a: T, b: T) => number) {
    this.sortFn = sort;
    if (!this.eof) {
      // if we didn't read all the data from the provider, we need to throw away
      // any data we read before.
      this.data = undefined;
      this.asyncLoads = [];
    } else if (this.data) {
      this.data.sort(sort);
    }

    for (const child of this.children.values()) {
      child.setSort(sort);
    }
  }

  /** Gets a data provider for the children of the item. */
  public getChildren(item: T): DataProvider<T> {
    let children = this.children.get(item);
    if (!children) {
      children = this._getChildren(item);
      this.children.set(item, children);
    }

    return children;
  }

  /**
   * Gets whether the all data possible to load until the `upTo` length has
   * already been loaded, or is being loaded.
   */
  public didReadUpTo(upTo: number) {
    if (this.eof || !this._read) {
      return true;
    }

    const load = this.asyncLoads[this.asyncLoads.length - 1];
    return !!(load && load.upTo >= upTo);
  }

  /** Reads so that the data is at least `upToLength` long, unless we reach the end */
  public async read(upTo: number): Promise<readonly T[]> {
    // not a data source that loads asynchronously:
    if (!this._read) {
      return Promise.resolve(this.loaded);
    }

    const last = this.asyncLoads[this.asyncLoads.length - 1] || { upTo: 0, p: Promise.resolve() };
    // already loaded past `upTo`:
    if (last.upTo >= upTo) {
      return last.p;
    }

    const p = last.p.then(async () => {
      const newData = await this._read!(last.upTo, upTo, this.sortFn);
      if (!this.data?.length) {
        this.data = newData;
      } else {
        this.data = this.data.concat(newData);
      }

      return this.data;
    });

    this.asyncLoads.push({ upTo, p });

    return p;
  }
}

/**
 * Data source that provides a stream of items, and includes the list of
 * accessible properties and a function that can be used to recurse into
 * children.
 */
export interface IDataSource<T> {
  data: DataProvider<T>;
  properties: { [key: string]: Property<T> };
  genericMatchStr: (node: T) => string;
}

export interface IQuery<T> {
  datasource: IDataSource<T>;
  input: string;
  regex: boolean;
  caseSensitive: boolean;
}

export type IQueryResults<T> = {
  all: boolean;
  selected: Set<T>;
  selectedAndParents: Set<T>;
};

export const evaluate = <T>(q: IQuery<T>): IQueryResults<T> => {
  const filter = compile(lex(q.input), q);
  const results: IQueryResults<T> = {
    selected: new Set(),
    selectedAndParents: new Set(),
    all: !q.input.trim(),
  };
  for (const model of q.datasource.data.loaded) {
    filterDeep(q.datasource.data, filter, model, results);
  }

  return results;
};

const filterDeep = <T>(
  s: DataProvider<T>,
  filter: (model: T) => boolean,
  model: T,
  results: IQueryResults<T>,
) => {
  let anyChild = false;
  if (filter(model)) {
    results.selected.add(model);
    results.selectedAndParents.add(model);
    anyChild = true;
  }

  const children = s.getChildren(model);
  for (const child of children.loaded) {
    if (filterDeep(children, filter, child, results)) {
      results.selectedAndParents.add(model);
      anyChild = true;
    }
  }

  return anyChild;
};
