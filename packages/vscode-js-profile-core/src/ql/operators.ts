/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { isDefined } from '../array';
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
      const [, p1, p2] = /^\/(.+)\/([a-z])*$/.exec(n) || [];
      const re = isDefined(p1) && isDefined(p2) ? new RegExp(p1, p2) : new RegExp(n);
      return v => {
        re.lastIndex = 0;
        return re.test(v);
      };
    },
  },
};
