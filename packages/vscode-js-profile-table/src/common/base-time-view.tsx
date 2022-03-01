/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ComponentChild, ComponentType, Fragment, FunctionComponent, h } from 'preact';
import VirtualList from 'preact-virtual-list';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addToSet, removeFromSet, toggleInSet } from 'vscode-js-profile-core/out/esm/array';
import { ICommonNode } from 'vscode-js-profile-core/out/esm/common/model';
import { IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import { ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';
import { IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import styles from './time-view.css';
import { SortFn } from './types';

const getGlobalUniqueId = (node: ICommonNode) => {
  const parts = [node.id];
  for (let n = node.parent; n; n = n.parent) {
    parts.push(n.id);
  }

  return parts.join('-');
};

type NodeAtDepth<T> = { node: T; depth: number; position: number };

export interface IRowProps<T> {
  node: T;
  depth: number;
  position: number;
  expanded: boolean;
  onExpanded: (isExpanded: boolean, target: T) => void;
  onKeyDown: (evt: KeyboardEvent, target: T) => void;
  onFocus: (target: T) => void;
}

export const makeBaseTimeView = <T extends IGraphNode | ITreeNode>(): FunctionComponent<{
  query: IQueryResults<T>;
  data: T[];
  sortFn: SortFn | undefined;
  header: ComponentChild;
  row: ComponentType<IRowProps<T>>;
}> => ({ data, header, query, sortFn, row: Row }) => {
  type NodeAtDepth = { node: T; depth: number; position: number };

  const listRef = useRef<{ base: HTMLElement }>();
  const [focused, setFocused] = useState<T | undefined>(undefined);
  const [expanded, setExpanded] = useState<ReadonlySet<T>>(new Set());

  const getSortedChildren = (node: T) => {
    const children = Object.values(node.children);
    if (sortFn) {
      children.sort((a, b) => sortFn(b) - sortFn(a));
    }

    return children;
  };

  // 1. Top level sorted items
  const sorted = useMemo(
    () => (sortFn ? data.slice().sort((a, b) => sortFn(b) - sortFn(a)) : data),
    [data, sortFn],
  );

  // 2. Expand nested child nodes
  const rendered = useMemo(() => {
    const output: NodeAtDepth[] = sorted
      .filter(node => query.selectedAndParents.has(node))
      .map(node => ({ node, position: 1, depth: 0 }));

    for (let i = 0; i < output.length; i++) {
      const { node, depth } = output[i];
      if (expanded.has(node)) {
        const toAdd = getSortedChildren(node).map((node, i) => ({
          node,
          position: i + 1,
          depth: depth + 1,
        }));
        output.splice(i + 1, 0, ...toAdd);
        // we don't increment i further since we want to recurse and expand these nodes
      }
    }

    return output;
  }, [sorted, expanded, sortFn, query]);

  const onKeyDown = useCallback(
    (evt: KeyboardEvent, node: T) => {
      let nextFocus: T | undefined;
      switch (evt.key) {
        case 'Enter':
        case 'Space':
          setExpanded(toggleInSet(expanded, node));
          evt.preventDefault();
          break;
        case 'ArrowDown':
          nextFocus = rendered[rendered.findIndex(n => n.node === node) + 1]?.node;
          break;
        case 'ArrowUp':
          nextFocus = rendered[rendered.findIndex(n => n.node === node) - 1]?.node;
          break;
        case 'ArrowLeft':
          if (expanded.has(node)) {
            setExpanded(removeFromSet(expanded, node));
          } else {
            nextFocus = node.parent as T;
          }
          break;
        case 'ArrowRight':
          if (node.childrenSize > 0 && !expanded.has(node)) {
            setExpanded(addToSet(expanded, node));
          } else {
            nextFocus = rendered.find(n => n.node.parent === node)?.node;
          }
          break;
        case 'Home':
          if (listRef.current) {
            listRef.current.base.scrollTop = 0;
          }

          nextFocus = rendered[0]?.node;
          break;
        case 'End':
          if (listRef.current) {
            listRef.current.base.scrollTop = listRef.current.base.scrollHeight;
          }

          nextFocus = rendered[rendered.length - 1]?.node;
          break;
        case '*':
          const nextExpanded = new Set(expanded);
          for (const child of Object.values(focused?.parent?.children || {})) {
            nextExpanded.add(child);
          }
          setExpanded(nextExpanded);
          break;
      }

      if (nextFocus) {
        setFocused(nextFocus);
        evt.preventDefault();
      }
    },
    [rendered, expanded, getSortedChildren],
  );

  useEffect(() => listRef.current?.base.setAttribute('role', 'tree'), [listRef.current]);

  useLayoutEffect(() => {
    const el = listRef.current?.base;
    if (!el || !focused) {
      return;
    }

    setTimeout(() => {
      const button: HTMLButtonElement | null = el.querySelector(
        `[data-row-id="${getGlobalUniqueId(focused)}"]`,
      );
      button?.focus();
    });
  }, [focused]);

  const onExpanded = (isExpanded: boolean, node: T) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(node);
      } else {
        next.delete(node);
      }

      return next.size !== prev.size ? next : prev;
    });
  };

  const renderRow = useCallback(
    (row: NodeAtDepth) => (
      <Row
        onKeyDown={onKeyDown}
        node={row.node}
        depth={row.depth}
        position={row.position}
        expanded={expanded.has(row.node)}
        onExpanded={onExpanded}
        onFocus={setFocused}
      />
    ),
    [expanded, setExpanded, onKeyDown],
  );

  return (
    <Fragment>
      {header}
      <VirtualList
        ref={listRef}
        className={styles.rows}
        data={rendered}
        renderRow={renderRow}
        rowHeight={25}
        overscanCount={100}
      />
    </Fragment>
  );
};
