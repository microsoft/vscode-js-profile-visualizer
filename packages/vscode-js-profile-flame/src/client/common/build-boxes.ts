/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Category } from 'vscode-js-profile-core/out/esm/cpu/model';
import { Constants } from './constants';
import { IBox, IColumn, IColumnRow } from './types';

const getBoxInRowColumn = (
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

const pickColor = (row: IColumnRow): number => {
  if (row.category === Category.System) {
    return -1;
  }

  const hash = row.graphId * 5381; // djb2's prime, just some bogus stuff
  return hash & 0xff;
};

export default (columns: ReadonlyArray<IColumn>, filtered: ReadonlyArray<number>) => {
  const boxes: Map<number, IBox> = new Map();
  let maxY = 0;
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    const highlightY = filtered[x];
    for (let y = 0; y < col.rows.length; y++) {
      const loc = col.rows[y];
      if (typeof loc === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        getBoxInRowColumn(columns, boxes, x, y)!.x2 = col.x2;
      } else {
        const y1 = Constants.BoxHeight * y + Constants.TimelineHeight;
        const y2 = y1 + Constants.BoxHeight;
        boxes.set(loc.graphId, {
          column: x,
          row: y,
          x1: col.x1,
          x2: col.x2,
          y1,
          y2,
          level: y,
          text: loc.callFrame.functionName,
          color: pickColor(loc),
          category: y <= highlightY ? loc.category : Category.Deemphasized,
          loc,
        });

        maxY = Math.max(y2, maxY);
      }
    }
  }

  return {
    boxById: boxes,
    maxY,
  };
};
