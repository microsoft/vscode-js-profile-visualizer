/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ComponentChild, ComponentType, Fragment, FunctionComponent, h } from 'preact';
import {
  StateUpdater,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { addToSet, removeFromSet, toggleInSet } from 'vscode-js-profile-core/out/esm/array';
import { ICommonNode } from 'vscode-js-profile-core/out/esm/common/model';
import { DataProvider, IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import styles from './time-view.css';
import { SortFn } from './types';
import { makeVirtualList } from './virtual-list';

const getGlobalUniqueId = (node: ICommonNode) => {
  const parts = [node.id];
  for (let n = node.parent; n; n = n.parent) {
    parts.push(n.id);
  }

  return parts.join('-');
};

export interface IRowProps<T> {
  node: T;
  depth: number;
  position: number;
  expanded: boolean;
  numChildren: number;
  onExpanded: (isExpanded: boolean, target: T) => void;
  onKeyDown: (evt: KeyboardEvent, target: T) => void;
  onFocus: (target: T) => void;
  onClick?: (evt: MouseEvent) => void;
}

const DEFAULT_CHILDREN_LOAD_LEN = 100;

const onDidFinishRead = <T,>(
  node: T,
  promise: Promise<void>,
  setChildLoads: StateUpdater<ReadonlyMap<T, Promise<void>>>,
): void => {
  setChildLoads(prev => {
    if (prev.get(node) === promise) {
      const next = new Map(prev);
      next.delete(node);
      return next;
    } else {
      return prev;
    }
  });
};

export const makeBaseTimeView = <T extends ICommonNode>(): FunctionComponent<{
  query: IQueryResults<T>;
  data: DataProvider<T>;
  sortFn: SortFn<T> | undefined;
  header: ComponentChild;
  row: ComponentType<IRowProps<T>>;
}> => {
  /**
   * Type for rendered nodes. `node` is omitted for the 'footer' of the
   * category.
   */
  type NodeAtDepth = {
    node: T;
    entireSubtree?: boolean;
    isFooter?: boolean;
    provider: DataProvider<T>;
    depth: number;
    position: number;
  };
  const VirtualList = makeVirtualList<NodeAtDepth>();
  return ({ data, header, query, sortFn, row: Row }) => {
    /** Map of nodes to the provider that created them. */
    const providers = useRef<WeakMap<T, DataProvider<T>>>(new Map());

    /** Map of nodes to promises that resolve when all their children are loaded. */
    const [childLoads, setChildLoads] = useState<ReadonlyMap<T, Promise<void>>>(new Map());

    const listRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState<T | undefined>(undefined);
    const [expanded, setExpanded] = useState<ReadonlySet<T>>(new Set());

    // const getSortedChildren = (node: T) => {
    //   const children = Object.values(node.children);
    //   if (sortFn) {
    //     children.sort((a, b) => sortFn(b) - sortFn(a));
    //   }

    //   return children;
    // };

    // 1. Top level sorted items
    const sorted = useMemo(() => {
      const topLevel = sortFn ? data.loaded.slice().sort(sortFn) : data.loaded;
      for (const node of topLevel) {
        data.setSort(sortFn);
        providers.current.set(node, data);
      }
      return topLevel;
    }, [data, sortFn]);

    // 2. Expand nested child nodes
    const rendered = useMemo(() => {
      const output: NodeAtDepth[] = sorted
        .filter(node => query.selectedAndParents.has(node))
        .map(node => ({ node, position: 1, depth: 0, provider: data }));

      for (let i = 0; i < output.length; i++) {
        const { node, depth, isFooter, entireSubtree } = output[i];
        if (isFooter) {
          continue; // footer of previous depth
        }

        if (expanded.has(node)) {
          const children = providers.current.get(node)?.getChildren(node);
          if (children) {
            for (const child of children.loaded) {
              providers.current.set(child, children);
            }

            const toAdd: NodeAtDepth[] = [];
            for (const child of children.loaded) {
              if (query.all || query.selectedAndParents.has(child) || entireSubtree) {
                toAdd.push({
                  node: child,
                  position: i + 1,
                  depth: depth + 1,
                  provider: children,
                  entireSubtree: entireSubtree || query.selected.has(child),
                });
              }
            }
            // footer:
            if (query.all) {
              toAdd.push({
                isFooter: true,
                node,
                position: i + toAdd.length,
                depth: depth + 1,
                provider: children,
              });
            }

            output.splice(i + 1, 0, ...toAdd);
            // we don't increment i further since we want to recurse and expand these nodes
          }
        }
      }

      return output;
    }, [sorted, expanded, sortFn, query, childLoads]);

    const onKeyDown = useCallback(
      (evt: KeyboardEvent, node: T) => {
        const provider = providers.current.get(node);

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
          case 'ArrowRight': {
            const children = provider?.getChildren(node);
            if (children?.length && !expanded.has(node)) {
              setExpanded(addToSet(expanded, node));
            } else {
              nextFocus = rendered.find(n => n.node?.parent === node)?.node;
            }
            break;
          }
          case 'Home':
            if (listRef.current) {
              listRef.current.scrollTop = 0;
            }

            nextFocus = rendered[0]?.node;
            break;
          case 'End':
            if (listRef.current) {
              listRef.current.scrollTop = listRef.current.scrollHeight;
            }

            nextFocus = rendered[rendered.length - 1]?.node;
            break;
          case '*': {
            const nextExpanded = new Set(expanded);
            if (focused && focused.parent) {
              const parent = focused?.parent;
              const parentProvider = parent && providers.current.get(parent as T);
              for (const child of parentProvider?.getChildren(focused).loaded || []) {
                nextExpanded.add(child);
              }
              setExpanded(nextExpanded);
            }
            break;
          }
        }

        if (nextFocus) {
          setFocused(nextFocus);
          evt.preventDefault();
        }
      },
      [rendered, expanded],
    );

    useEffect(() => {
      setChildLoads(prev => {
        let next: Map<T, Promise<void>> | undefined;
        for (const node of expanded) {
          const children = providers.current.get(node)?.getChildren(node);
          if (children && !children.didReadUpTo(DEFAULT_CHILDREN_LOAD_LEN)) {
            next ??= new Map(prev);
            const promise: Promise<void> = children
              .read(DEFAULT_CHILDREN_LOAD_LEN)
              .then(() => onDidFinishRead(node, promise, setChildLoads));

            next.set(node, promise);
          }
        }

        return next || prev;
      });
      // note: sortFn is used here since changing the sort order can cause
      // data to be thrown away and we would need to re-request it.
    }, [expanded, sortFn]);

    useEffect(() => listRef.current?.setAttribute('role', 'tree'), [listRef.current]);

    useLayoutEffect(() => {
      const el = listRef.current;
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

    const onLoadMore = useCallback((nodeUn: unknown, dataProvider: DataProvider<unknown>) => {
      const dp = dataProvider as DataProvider<T>;
      const node = nodeUn as T;

      setChildLoads(prev => {
        const next = new Map(prev);
        const promise: Promise<void> = dp
          .read(dp.loaded.length + DEFAULT_CHILDREN_LOAD_LEN)
          .then(() => onDidFinishRead(node, promise, setChildLoads));
        next.set(node, promise);
        return next;
      });
    }, []);

    const renderRow = useCallback(
      (row: NodeAtDepth) =>
        row.isFooter ? (
          <FooterRow
            node={row.node as T}
            depth={row.depth}
            position={row.position}
            promise={childLoads.get(row.node as T)}
            dataProvider={row.provider}
            onLoadMore={onLoadMore}
          />
        ) : (
          <Row
            onKeyDown={onKeyDown}
            node={row.node}
            depth={row.depth}
            position={row.position}
            numChildren={row.provider.getChildren(row.node).length}
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
          containerRef={listRef}
          className={styles.rows}
          data={rendered}
          renderRow={renderRow}
          rowHeight={25}
          overscanCount={30}
        />
      </Fragment>
    );
  };
};
const FooterRow: FunctionComponent<{
  depth: number;
  position: number;
  node: unknown;
  promise: Promise<void> | undefined;
  dataProvider: DataProvider<unknown>;
  onLoadMore: (node: unknown, evt: DataProvider<unknown>) => void;
}> = ({ depth, position, node, dataProvider, promise, onLoadMore }) => {
  const [isLoading, setIsLoading] = useState(!!promise);
  if (dataProvider.eof) {
    return null;
  }

  useEffect(() => {
    if (!promise) {
      setIsLoading(false);
    } else {
      promise.finally(() => setIsLoading(false));
    }
  }, [promise]);

  return (
    <div
      className={styles.row}
      data-row-id={`loading-${position}`}
      tabIndex={0}
      role="treeitem"
      aria-posinset={position}
      aria-level={depth + 1}
    >
      <div className={styles.footer} style={{ paddingLeft: depth * 15 }}>
        {isLoading ? (
          'Loading...'
        ) : (
          <Fragment>
            <a role="button" onClick={() => onLoadMore(node, dataProvider)}>
              Load more rows
            </a>
          </Fragment>
        )}
      </div>
    </div>
  );
};
