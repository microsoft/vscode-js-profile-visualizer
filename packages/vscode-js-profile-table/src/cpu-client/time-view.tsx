/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Fragment, FunctionComponent, h } from 'preact';
import VirtualList from 'preact-virtual-list';
import { useCallback } from 'preact/hooks';
import * as ChevronDown from 'vscode-codicons/src/icons/chevron-down.svg';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { getNodeText } from 'vscode-js-profile-core/out/esm/common/display';
import { decimalFormat } from 'vscode-js-profile-core/out/esm/cpu/display';
import { IGraphNode, ILocation } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import getGlobalUniqueId from '../common/get-global-unique-id';
import ImpactBar from '../common/impact-bar';
import styles from '../common/time-view.css';
import { SortFn } from '../common/types';
import useTimeView from '../common/use-time-view';
import useTimeViewRow from '../common/use-time-view-row';

const selfTime: SortFn = n => (n as ILocation).selfTime;
const aggTime: SortFn = n => (n as ILocation).aggregateTime;

type NodeAtDepth = { node: IGraphNode; depth: number; position: number };

export const TimeView: FunctionComponent<{
  query: IQueryResults<IGraphNode>;
  data: IGraphNode[];
}> = ({ data, query }) => {
  const { listRef, rendered, onKeyDown, expanded, setExpanded, setFocused, sortFn, setSortFn } =
    useTimeView({ data, query, initSortFn: selfTime });

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
      id="self-time-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === selfTime ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sortFn === selfTime ? undefined : selfTime)),
        [sortFn],
      )}
    >
      {sortFn === selfTime && <Icon i={ChevronDown} />}
      Self Time
    </div>
    <div
      id="total-time-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sortFn === aggTime ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sortFn === aggTime ? undefined : aggTime)),
        [sortFn],
      )}
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
  position: number;
  expanded: ReadonlySet<IGraphNode>;
  onExpandChange: (expanded: ReadonlySet<IGraphNode>) => void;
  onKeyDown?: (evt: KeyboardEvent, node: IGraphNode) => void;
  onFocus?: (node: IGraphNode) => void;
}> = ({
  node,
  depth,
  position,
  expanded,
  onKeyDown: onKeyDownRaw,
  onFocus: onFocusRaw,
  onExpandChange,
}) => {
  const { root, expand, onKeyDown, onFocus, onToggleExpand, onClick } = useTimeViewRow<IGraphNode>({
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
      <div className={styles.duration} aria-labelledby="self-time-header">
        <ImpactBar impact={node.selfTime / root.selfTime} />
        {decimalFormat.format(node.selfTime / 1000)}ms
      </div>
      <div className={styles.duration} aria-labelledby="total-time-header">
        <ImpactBar impact={node.aggregateTime / root.aggregateTime} />
        {decimalFormat.format(node.aggregateTime / 1000)}ms
      </div>
      {!location ? (
        <div
          className={classes(styles.location, styles.virtual)}
          style={{ marginLeft: depth * 15 }}
        >
          {expand} <span className={styles.fn}>{node.callFrame.functionName}</span>
        </div>
      ) : (
        <div className={styles.location} style={{ marginLeft: depth * 15 }}>
          {expand} <span className={styles.fn}>{node.callFrame.functionName}</span>
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
