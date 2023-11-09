/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as ChevronDown from '@vscode/codicons/src/icons/chevron-down.svg';
import { FunctionComponent, h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { decimalFormat } from 'vscode-js-profile-core/out/esm/cpu/display';
import { IGraphNode, ILocation } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import { IRowProps, makeBaseTimeView } from '../common/base-time-view';
import { makeBaseTimeViewRow } from '../common/base-time-view-row';
import ImpactBar from '../common/impact-bar';
import styles from '../common/time-view.css';
import { SortFn } from '../common/types';

const selfTime: SortFn = n => (n as ILocation).selfTime;
const aggTime: SortFn = n => (n as ILocation).aggregateTime;

const BaseTimeView = makeBaseTimeView<IGraphNode>();

export const TimeView: FunctionComponent<{
  query: IQueryResults<IGraphNode>;
  data: IGraphNode[];
}> = ({ data, query }) => {
  const [sortFn, setSortFn] = useState<SortFn | undefined>(() => selfTime);

  return (
    <BaseTimeView
      data={data}
      sortFn={sortFn}
      query={query}
      header={<TimeViewHeader sortFn={sortFn} onChangeSort={setSortFn} />}
      row={TimeViewRow}
    />
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

const BaseTimeViewRow = makeBaseTimeViewRow<IGraphNode>();

const TimeViewRow: FunctionComponent<IRowProps<IGraphNode>> = props => {
  const { node } = props;
  let root = props.node;
  while (root.parent) {
    root = root.parent;
  }

  return (
    <BaseTimeViewRow {...props}>
      <div className={styles.duration} aria-labelledby="self-time-header">
        <ImpactBar impact={node.selfTime / root.selfTime} />
        {decimalFormat.format(node.selfTime / 1000)}ms
      </div>
      <div className={styles.duration} aria-labelledby="total-time-header">
        <ImpactBar impact={node.aggregateTime / root.aggregateTime} />
        {decimalFormat.format(node.aggregateTime / 1000)}ms
      </div>
    </BaseTimeViewRow>
  );
};
