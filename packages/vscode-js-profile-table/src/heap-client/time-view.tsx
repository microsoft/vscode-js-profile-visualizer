/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Fragment, FunctionComponent, h } from 'preact';
import VirtualList from 'preact-virtual-list';
import { useCallback } from 'preact/hooks';
import * as ChevronDown from 'vscode-codicons/src/icons/chevron-down.svg';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { decimalFormat, getNodeText } from 'vscode-js-profile-core/out/esm/heap/display';
import { IHeapProfileNode, ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';
import { IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import ImpactBar from '../common/impact-bar';
import styles from '../common/time-view.css';
import { SortFn } from '../common/types';
import useTimeView from '../common/use-time-view';
import useTimeViewRow from '../common/use-time-view-row';

const selfSize: SortFn = n => (n as IHeapProfileNode).selfSize;
const totalSize: SortFn = n => (n as IHeapProfileNode).totalSize;

type NodeAtDepth = { node: ITreeNode; depth: number; position: number };

const getGlobalUniqueId = (node: ITreeNode) => {
  const parts = [node.id];
  for (let n = node.parent; n; n = n.parent) {
    parts.push(n.id);
  }

  return parts.join('-');
};

export const TimeView: FunctionComponent<{
  query: IQueryResults<ITreeNode>;
  data: ITreeNode[];
}> = ({ data, query }) => {
  const { listRef, rendered, onKeyDown, expanded, setExpanded, setFocused, sortFn, setSortFn } =
    useTimeView({ data, query, initSortFn: selfSize });

  const renderRow = useCallback(
    (row: NodeAtDepth) => (
      <TimeViewRow
        onKeyDown={onKeyDown}
        node={row.node}
        depth={row.depth}
        position={row.position}
        expanded={expanded}
        onExpandChange={setExpanded}
        onFocus={setFocused}
      />
    ),
    [expanded, setExpanded, onKeyDown],
  );

  return (
    <Fragment>
      <TimeViewHeader sortFn={sortFn} onChangeSort={setSortFn} />
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

const TimeViewHeader: FunctionComponent<{
  sortFn: SortFn | undefined;
  onChangeSort: (newFn: () => SortFn | undefined) => void;
}> = ({ sortFn, onChangeSort }) => (
  <div className={styles.row}>
    <div
      id="self-size-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === selfSize ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sortFn === selfSize ? undefined : selfSize)),
        [sortFn],
      )}
    >
      {sortFn === selfSize && <Icon i={ChevronDown} />}
      Self Size
    </div>
    <div
      id="total-size-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === totalSize ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sortFn === totalSize ? undefined : totalSize)),
        [sortFn],
      )}
    >
      {sortFn === totalSize && <Icon i={ChevronDown} />}
      Total Size
    </div>
    <div className={styles.heading}>File</div>
  </div>
);

const TimeViewRow: FunctionComponent<{
  node: ITreeNode;
  depth: number;
  position: number;
  expanded: ReadonlySet<ITreeNode>;
  onExpandChange: (expanded: ReadonlySet<ITreeNode>) => void;
  onKeyDown?: (evt: KeyboardEvent, node: ITreeNode) => void;
  onFocus?: (node: ITreeNode) => void;
}> = ({
  node,
  depth,
  position,
  expanded,
  onKeyDown: onKeyDownRaw,
  onFocus: onFocusRaw,
  onExpandChange,
}) => {
  const { root, expand, onKeyDown, onFocus, onToggleExpand, onClick } = useTimeViewRow({
    node,
    expanded,
    onKeyDownRaw,
    onFocusRaw,
    onExpandChange,
  });

  const location = getNodeText(node);

  return (
    <div
      className={styles.row}
      data-row-id={getGlobalUniqueId(node)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onToggleExpand}
      tabIndex={0}
      role="treeitem"
      aria-posinset={position}
      aria-setsize={node.parent?.childrenSize ?? 1}
      aria-level={depth + 1}
      aria-expanded={expanded.has(node)}
    >
      <div className={styles.duration} aria-labelledby="self-size-header">
        <ImpactBar impact={node.selfSize / node.totalSize} />
        {decimalFormat.format(node.selfSize)}
      </div>
      <div className={styles.duration} aria-labelledby="total-size-header">
        <ImpactBar impact={node.totalSize / root.totalSize} />
        {decimalFormat.format(node.totalSize)}
      </div>
      {!location ? (
        <div
          className={classes(styles.location, styles.virtual)}
          style={{ marginLeft: depth * 15 }}
        >
          {expand} <span className={styles.fn}>{node.callFrame.functionName || '(anonymous)'}</span>
        </div>
      ) : (
        <div className={styles.location} style={{ marginLeft: depth * 15 }}>
          {expand} <span className={styles.fn}>{node.callFrame.functionName || '(anonymous)'}</span>
          <span className={styles.file}>
            <a href="#" onClick={onClick}>
              {location}
            </a>
          </span>
        </div>
      )}
    </div>
  );
};
