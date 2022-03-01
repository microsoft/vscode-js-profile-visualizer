/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CodeLens, Position, Range } from 'vscode';
import { ILocation } from '../cpu/model';
import { lowerCaseInsensitivePath } from '../path';
import { ProfileAnnotations } from '../profileAnnotations';
import { decimalFormat } from './display';

export interface IProfileInformation {
  selfTime: number;
  aggregateTime: number;
  ticks: number;
}

/**
 * A collection of profile data. Paths are expanded lazily, as doing so
 * up-front for very large profiles turned out to be costly (mainly in path)
 * manipulation.
 */
export class CpuProfileAnnotations extends ProfileAnnotations<ILocation> {
  private readonly data = new Map<string, { position: Position; data: IProfileInformation }[]>();

  /**
   * Adds a new code lens at the given location in the file.
   */
  protected set(file: string, position: Position, data: ILocation) {
    let list = this.data.get(lowerCaseInsensitivePath(file));
    if (!list) {
      list = [];
      this.data.set(lowerCaseInsensitivePath(file), list);
    }

    let index = 0;
    while (index < list.length && list[index].position.line < position.line) {
      index++;
    }

    if (list[index]?.position.line === position.line) {
      const existing = list[index];
      if (position.character < existing.position.character) {
        existing.position = new Position(position.line, position.character);
      }
      existing.data.aggregateTime += data.aggregateTime;
      existing.data.selfTime += data.selfTime;
      existing.data.ticks += data.ticks;
    } else {
      list.splice(index, 0, {
        position: new Position(position.line, position.character),
        data: {
          aggregateTime: data.aggregateTime,
          selfTime: data.selfTime,
          ticks: data.ticks,
        },
      });
    }
  }

  /**
   * Get all lenses for a file. Ordered by line number.
   */
  public getLensesForFile(file: string): CodeLens[] {
    this.expandForFile(file);

    return (
      this.data
        .get(lowerCaseInsensitivePath(file))
        ?.map(({ position, data }) => {
          if (data.aggregateTime === 0 && data.selfTime === 0) {
            return [];
          }

          const range = new Range(position, position);
          return [
            new CodeLens(range, {
              title:
                `${decimalFormat.format(data.selfTime / 1000)}ms Self Time, ` +
                `${decimalFormat.format(data.aggregateTime / 1000)}ms Total`,
              command: '',
            }),
            new CodeLens(range, {
              title: 'Clear',
              command: 'extension.jsProfileVisualizer.table.clearCodeLenses',
            }),
          ];
        })
        .reduce((acc, lenses) => [...acc, ...lenses], []) ?? []
    );
  }
}
