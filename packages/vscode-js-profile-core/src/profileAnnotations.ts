/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CodeLens, Position } from 'vscode';
import { once } from './array';
import { INode } from './common/model';
import { getCandidateDiskPaths } from './open-location';

const basenameRe = /[^/\\]+$/;
export const getBasename = (pathOrUrl: string) => basenameRe.exec(pathOrUrl)?.[0] ?? pathOrUrl;

/**
 * A collection of profile data. Paths are expanded lazily, as doing so
 * up-front for very large profiles turned out to be costly (mainly in path)
 * manipulation.
 */
export abstract class ProfileAnnotations<DataType, NodeType extends INode> {
  protected readonly basenamesToExpand = new Map<string, (() => void)[]>();
  protected readonly data = new Map<string, { position: Position; data: DataType }[]>();

  public add(rootPath: string | undefined, node: NodeType) {
    const expand = once(() => {
      const src = node.src;
      if (src && src.source.sourceReference === 0 && src.source.path) {
        for (const path of getCandidateDiskPaths(rootPath, src.source)) {
          this.set(
            path,
            new Position(Math.max(0, src.lineNumber), Math.max(0, src.columnNumber)),
            node,
          );
        }
        return;
      }

      this.set(
        node.callFrame.url,
        new Position(
          Math.max(0, node.callFrame.lineNumber),
          Math.max(0, node.callFrame.columnNumber),
        ),
        node,
      );
    });

    this.addExpansionFn(getBasename(node.callFrame.url), expand);
    if (node.src?.source.path) {
      this.addExpansionFn(getBasename(node.src.source.path), expand);
    }
  }
  /**
   * Adds a function to expand performance data for the given location.
   */
  protected addExpansionFn(basename: string, expand: () => void) {
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
  protected abstract set(file: string, position: Position, data: NodeType): void;

  /**
   * Get all lenses for a file. Ordered by line number.
   */
  public abstract getLensesForFile(file: string): CodeLens[];

  protected expandForFile(file: string) {
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
