/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export enum PropertyType {
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
