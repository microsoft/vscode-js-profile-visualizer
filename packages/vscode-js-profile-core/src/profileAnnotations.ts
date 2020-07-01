/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CodeLens, Range, Position } from 'vscode';
import { lowerCaseInsensitivePath } from './path';
import { ILocation } from './cpu/model';
import { once } from './array';
import { getCandidateDiskPaths } from './open-location';

export interface IProfileInformation {
  selfTime: number;
  aggregateTime: number;
  ticks: number;
}

const decimalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const basenameRe = /[^/\\]+$/;
const getBasename = (pathOrUrl: string) => basenameRe.exec(pathOrUrl)?.[0] ?? pathOrUrl;

/**
 * A collection of profile data. Paths are expanded lazily, as doing so
 * up-front for very large profiles turned out to be costly (mainly in path)
 * manipulation.
 */
export class ProfileAnnotations {
  private readonly basenamesToExpand = new Map<string, (() => void)[]>();
  private readonly data = new Map<string, { position: Position; data: IProfileInformation }[]>();

  public add(rootPath: string | undefined, location: ILocation) {
    const expand = once(() => {
      this.set(
        location.callFrame.url,
        new Position(
          Math.max(0, location.callFrame.lineNumber),
          Math.max(0, location.callFrame.columnNumber),
        ),
        location,
      );

      const src = location.src;
      if (!src || src.source.sourceReference !== 0 || !src.source.path) {
        return;
      }

      for (const path of getCandidateDiskPaths(rootPath, src.source)) {
        this.set(
          path,
          new Position(Math.max(0, src.lineNumber - 1), Math.max(0, src.columnNumber - 1)),
          location,
        );
      }
    });

    this.addExpansionFn(getBasename(location.callFrame.url), expand);
    if (location.src?.source.path) {
      this.addExpansionFn(getBasename(location.src.source.path), expand);
    }
  }

  /**
   * Adds a function to expand performance data for the given location.
   */
  private addExpansionFn(basename: string, expand: () => void) {
    let arr = this.basenamesToExpand.get(basename);
    if (!arr) {
      arr = [];
      this.basenamesToExpand.set(basename, arr);
    }

    arr.push(expand);
  }

  /**
   * Adds a new code lens at the given location in the file.
   */
  private set(file: string, position: Position, data: ILocation) {
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

  private expandForFile(file: string) {
    const basename = getBasename(file);
    const fns = this.basenamesToExpand.get(basename);
    if (!fns) {
      return;
    }

    for (const fn of fns) {
      fn();
    }

    this.basenamesToExpand.delete(basename);
  }
}
