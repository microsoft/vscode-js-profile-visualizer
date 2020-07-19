/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { compile, lex } from './parser';

export const enum PropertyType {
  String,
  Number,
}

export interface IPropertyToPrimitiveType {
  [PropertyType.Number]: number;
  [PropertyType.String]: string;
}

export interface IBasePropertyDefinition<TNode, TProp extends PropertyType> {
  type: TProp;
  accessor: (node: TNode) => IPropertyToPrimitiveType[TProp];
}

export type StringPropertyDefinition<T> = IBasePropertyDefinition<T, PropertyType.String>;
export type NumberPropertyDefinition<T> = IBasePropertyDefinition<T, PropertyType.Number>;
export type Property<T> = StringPropertyDefinition<T> | NumberPropertyDefinition<T>;

/**
 * Data source that provides a stream of items, and includes the list of
 * accessible properties and a function that can be used to recurse into
 * children.
 */
export interface IDataSource<T> {
  data: ReadonlyArray<T>;
  properties: { [key: string]: Property<T> };
  genericMatchStr: (node: T) => string;
  getChildren: (node: T) => ReadonlyArray<T>;
}

export interface IQuery<T> {
  datasource: IDataSource<T>;
  input: string;
  regex: boolean;
  caseSensitive: boolean;
}

export interface IQueryResults<T> {
  selected: Set<T>;
  selectedAndParents: Set<T>;
}

export const evaluate = <T>(q: IQuery<T>): IQueryResults<T> => {
  const filter = compile(lex(q.input), q);
  const results: IQueryResults<T> = { selected: new Set(), selectedAndParents: new Set() };
  for (const model of q.datasource.data) {
    filterDeep(q.datasource, filter, model, results);
  }

  return results;
};

const filterDeep = <T>(
  s: IDataSource<T>,
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

  for (const child of s.getChildren(model)) {
    if (filterDeep(s, filter, child, results)) {
      results.selectedAndParents.add(model);
      anyChild = true;
    }
  }

  return anyChild;
};
