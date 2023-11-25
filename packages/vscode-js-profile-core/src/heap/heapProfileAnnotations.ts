/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CodeLens, Position, Range } from 'vscode';
import { lowerCaseInsensitivePath } from '../path';
import { ProfileAnnotations } from '../profileAnnotations';
import { decimalFormat } from './display';
import { ITreeNode } from './model';

export interface IProfileInformation {
  selfSize: number;
  totalSize: number;
}

/**
 * A collection of profile data. Paths are expanded lazily, as doing so
 * up-front for very large profiles turned out to be costly (mainly in path)
 * manipulation.
 */
export class HeapProfileAnnotations extends ProfileAnnotations<ITreeNode> {
  private readonly data = new Map<string, { position: Position; data: IProfileInformation }[]>();

  /**
   * Adds a new code lens at the given treeNode in the file.
   */
  protected set(file: string, position: Position, data: ITreeNode) {
    let list = this.data.get(lowerCaseInsensitivePath(file));
    if (!list) {
      list = [];
      this.data.set(lowerCaseInsensitivePath(file), list);
    }

    let index = 0;
    while (index < list.length && (list[index]?.position.line || Infinity) < position.line) {
      index++;
    }

    const existing = list[index];
    if (existing?.position.line === position.line) {
      if (position.character < existing.position.character) {
        existing.position = new Position(position.line, position.character);
      }
      existing.data.totalSize += data.totalSize;
      existing.data.selfSize += data.selfSize;
    } else {
      list.splice(index, 0, {
        position: new Position(position.line, position.character),
        data: {
          totalSize: data.totalSize,
          selfSize: data.selfSize,
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
          if (data.totalSize === 0 && data.selfSize === 0) {
            return [];
          }

          const range = new Range(position, position);
          return [
            new CodeLens(range, {
              title:
                `${decimalFormat.format(data.selfSize / 1000)}kB Self Size, ` +
                `${decimalFormat.format(data.totalSize / 1000)}kB Total Size`,
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
