/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as ChevronDown from '@vscode/codicons/src/icons/chevron-down.svg';
import { FunctionComponent, h } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { decimalFormat } from 'vscode-js-profile-core/out/esm/heap/display';
import { IHeapProfileNode, ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';
import { IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import { IRowProps, makeBaseTimeView } from '../common/base-time-view';
import { makeBaseTimeViewRow } from '../common/base-time-view-row';
import ImpactBar from '../common/impact-bar';
import styles from '../common/time-view.css';
import { SortFn } from '../common/types';

const selfSize: SortFn = n => (n as IHeapProfileNode).selfSize;
const totalSize: SortFn = n => (n as IHeapProfileNode).totalSize;

const BaseTimeView = makeBaseTimeView<ITreeNode>();

export const TimeView: FunctionComponent<{
  query: IQueryResults<ITreeNode>;
  data: ITreeNode[];
}> = ({ data, query }) => {
  const [sortFn, setSortFn] = useState<SortFn | undefined>(() => selfSize);

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

const BaseTimeViewRow = makeBaseTimeViewRow<ITreeNode>();

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

const TimeViewRow: FunctionComponent<IRowProps<ITreeNode>> = props => {
  const { node } = props;
  let root = props.node;
  while (root.parent) {
    root = root.parent;
  }

  return (
    <BaseTimeViewRow {...props}>
      <div className={styles.duration} aria-labelledby="self-size-header">
        <ImpactBar impact={node.selfSize / node.totalSize} />
        {decimalFormat.format(node.selfSize / 1000)}kB
      </div>
      <div className={styles.duration} aria-labelledby="total-size-header">
        <ImpactBar impact={node.totalSize / root.totalSize} />
        {decimalFormat.format(node.totalSize / 1000)}kB
      </div>
    </BaseTimeViewRow>
  );
};
