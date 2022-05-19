/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IPropertyToPrimitiveType, Property, PropertyType } from './types';

export interface IOperator<T> {
  appliesTo: T;
  filter: (value: ReturnType<(Property<unknown> & { type: T })['accessor']>) => boolean;
}

export type IOperatorMap = {
  [K in PropertyType]: {
    [key: string]: (input: string) => (value: IPropertyToPrimitiveType[K]) => boolean;
  };
};

export const operators: IOperatorMap = {
  [PropertyType.Number]: {
    ':': n => v => v === Number(n),
    '=': n => v => v === Number(n),
    '>': n => v => v > Number(n),
    '<': n => v => v < Number(n),
    '<=': n => v => v <= Number(n),
    '>=': n => v => v >= Number(n),
    '<>': n => v => v !== Number(n),
    '!=': n => v => v !== Number(n),
  },
  [PropertyType.String]: {
    ':': n => v => v === n,
    '=': n => v => v === n,
    '!=': n => v => v !== n,
    '<>': n => v => v !== n,
    '~=': n => {
      const reExtract = /^\/(.+)\/([a-z])*$/.exec(n);
      const re = reExtract ? new RegExp(reExtract[1], reExtract[2]) : new RegExp(n);
      return v => {
        re.lastIndex = 0;
        return re.test(v);
      };
    },
  },
};
