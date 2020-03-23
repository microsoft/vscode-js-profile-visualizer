/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent, Fragment } from 'preact';
import styles from './time-view.css';
import { useMemo, useCallback, useContext, useState } from 'preact/hooks';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { ILocation, IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { IOpenDocumentMessage } from 'vscode-js-profile-core/out/esm/cpu/types';
import * as ChevronDown from 'vscode-codicons/src/icons/chevron-down.svg';
import * as ChevronRight from 'vscode-codicons/src/icons/chevron-right.svg';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import VirtualList from 'preact-virtual-list';
import { getLocationText, decimalFormat } from 'vscode-js-profile-core/out/esm/cpu/display';

type SortFn = (node: ILocation) => number;

const selfTime: SortFn = n => n.selfTime;
const aggTime: SortFn = n => n.aggregateTime;

export const TimeView: FunctionComponent<{
  graph: IGraphNode;
  filterFn: (input: string) => boolean;
}> = ({ filterFn, graph }) => {
  const [sortFn, setSort] = useState(() => selfTime);
  const [expanded, setExpanded] = useState<ReadonlySet<IGraphNode>>(new Set<IGraphNode>());

  const getSortedChildren = (node: IGraphNode) =>
    [...node.children.values()].sort((a, b) => sortFn(b) - sortFn(a));

  // 1. Top level sorted items
  const sorted = useMemo(() => getSortedChildren(graph), [graph, sortFn]);

  // 2. Expand nested child nodes
  const unfiltered = useMemo(() => {
    const output = sorted.map(node => ({ node, depth: 0 }));
    for (let i = 0; i < output.length; i++) {
      const { node, depth } = output[i];
      if (expanded.has(node)) {
        const toAdd = getSortedChildren(node).map(node => ({ node, depth: depth + 1 }));
        output.splice(i + 1, 0, ...toAdd);
        // we don't increment i further since we want to recurse and expand these nodes
      }
    }

    return output;
  }, [sorted, expanded, sortFn]);

  // 3. Filter based on query text
  const rendered = useMemo(
    () =>
      unfiltered.filter(
        ({ node: n }) =>
          filterFn(n.callFrame.functionName) ||
          filterFn(n.callFrame.url) ||
          filterFn(n.src?.source.path || ''),
      ),
    [unfiltered, filterFn],
  );

  const maxDepth = useMemo(() => rendered.reduce((max, n) => Math.max(n.depth, max), 0), [
    rendered,
  ]);

  const renderRow = useCallback(
    (row: { node: IGraphNode; depth: number }) => (
      <TimeViewRow
        node={row.node}
        depth={row.depth}
        expanded={expanded}
        maxDepth={maxDepth}
        onExpandChange={setExpanded}
      />
    ),
    [expanded, setExpanded],
  );

  return (
    <Fragment>
      <TimeViewHeader sortFn={sortFn} onChangeSort={setSort} />
      <VirtualList
        className={styles.rows}
        data={rendered}
        renderRow={renderRow}
        rowHeight={20}
        overscanCount={10}
      />
    </Fragment>
  );
};

const TimeViewHeader: FunctionComponent<{
  sortFn: SortFn;
  onChangeSort: (newFn: () => SortFn) => void;
}> = ({ sortFn, onChangeSort }) => (
  <div className={styles.row}>
    <div
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === selfTime ? 'descending' : undefined}
      onClick={useCallback(() => onChangeSort(() => selfTime), [useCallback])}
    >
      {sortFn === selfTime && <Icon i={ChevronDown} />}
      Self Time
    </div>
    <div
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === aggTime ? 'descending' : undefined}
      onClick={useCallback(() => onChangeSort(() => aggTime), [useCallback])}
    >
      {sortFn === aggTime && <Icon i={ChevronDown} />}
      Total Time
    </div>
    <div className={styles.heading}>File</div>
  </div>
);

const TimeViewRow: FunctionComponent<{
  node: IGraphNode;
  depth: number;
  maxDepth: number;
  expanded: ReadonlySet<IGraphNode>;
  onExpandChange: (expanded: ReadonlySet<IGraphNode>) => void;
}> = ({ node, maxDepth, depth, expanded, onExpandChange }) => {
  const vscode = useContext(VsCodeApi);
  const onClick = useCallback(
    (evt: MouseEvent) =>
      node.src?.source.path &&
      vscode.postMessage<IOpenDocumentMessage>({
        type: 'openDocument',
        path: node.src.source.path,
        lineNumber: node.src.lineNumber,
        columnNumber: node.src.columnNumber,
        toSide: evt.altKey,
      }),
    [vscode, node],
  );

  const onToggleExpand = useCallback(() => {
    const newSet = new Set([...expanded]);
    if (newSet.has(node)) {
      newSet.delete(node);
    } else {
      newSet.add(node);
    }

    onExpandChange(newSet);
  }, [expanded, onExpandChange, node]);

  const location = getLocationText(node);
  const selfImpact = node.selfTime / (node.parent?.selfTime || 1);
  const aggImpact = node.aggregateTime / (node.parent?.aggregateTime || 1);
  const expand =
    node.children.size > 0 ? (
      <button className={styles.expander} onClick={onToggleExpand}>
        <Icon i={expanded.has(node) ? ChevronDown : ChevronRight} />
      </button>
    ) : (
      <span className={styles.expanderSpacer} />
    );

  return (
    <div className={styles.row} style={{ opacity: Math.max(0.7, 1 - (maxDepth - depth) * 0.1) }}>
      <div className={styles.duration}>
        <div className={styles.impactBar} style={{ width: `${selfImpact * 100}%` }} />
        {decimalFormat.format(node.selfTime / 1000)}ms
      </div>
      <div className={styles.duration}>
        <div className={styles.impactBar} style={{ width: `${aggImpact * 100}%` }} />
        {decimalFormat.format(node.aggregateTime / 1000)}ms
      </div>
      {!location ? (
        <div className={classes(styles.file, styles.virtual)} style={{ marginLeft: depth * 15 }}>
          {expand} {node.callFrame.functionName}
        </div>
      ) : !node.src ? (
        <div className={styles.file} style={{ marginLeft: depth * 15 }}>
          {expand} {node.callFrame.functionName} @ {location}
        </div>
      ) : (
        <div className={styles.file} style={{ marginLeft: depth * 15 }}>
          {expand} {node.callFrame.functionName} @{' '}
          <a href="#" onClick={onClick}>
            {location}
          </a>
        </div>
      )}
    </div>
  );
};
