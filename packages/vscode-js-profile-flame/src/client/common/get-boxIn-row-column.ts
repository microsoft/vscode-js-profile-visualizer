/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IBox, IColumn } from './types';

export default (
  columns: ReadonlyArray<IColumn>,
  boxes: ReadonlyMap<number, IBox>,
  column: number,
  row: number,
) => {
  let candidate = columns[column]?.rows[row];
  if (typeof candidate === 'number') {
    candidate = columns[candidate].rows[row];
  }

  return candidate !== undefined
    ? boxes.get((candidate as { graphId: number }).graphId)
    : undefined;
};
