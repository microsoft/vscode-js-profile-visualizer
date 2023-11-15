/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as ChevronDown from '@vscode/codicons/src/icons/chevron-down.svg';
import * as TypeHierarchySub from '@vscode/codicons/src/icons/type-hierarchy-sub.svg';
import { Fragment, FunctionComponent, h } from 'preact';
import { useCallback, useContext, useMemo, useState } from 'preact/hooks';
import prettyBytes from 'pretty-bytes';
import { Icon } from 'vscode-js-profile-core/out/esm/client/icons';
import { classes } from 'vscode-js-profile-core/out/esm/client/util';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/common/types';
import { IClassGroup, INode } from 'vscode-js-profile-core/out/esm/heapsnapshot/rpc';
import { DataProvider, IQueryResults } from 'vscode-js-profile-core/out/esm/ql';
import { IRowProps, makeBaseTimeView } from '../common/base-time-view';
import { makeBaseTimeViewRow } from '../common/base-time-view-row';
import ImpactBar from '../common/impact-bar';
import styles from '../common/time-view.css';
import { SortFn } from '../common/types';

export type TableNode = (IClassGroup | INode) & {
  id: number;
  parent?: TableNode;
};

const BaseTimeView = makeBaseTimeView<TableNode>();

export const sortBySelfSize: SortFn<TableNode> = (a, b) => b.selfSize - a.selfSize;
export const sortByRetainedSize: SortFn<TableNode> = (a, b) => b.retainedSize - a.retainedSize;
export const sortByName: SortFn<TableNode> = (a, b) => a.name.localeCompare(b.name);

export const TimeView: FunctionComponent<{
  query: IQueryResults<TableNode>;
  data: DataProvider<TableNode>;
}> = ({ query, data }) => {
  const [sortFn, setSortFn] = useState<SortFn<TableNode> | undefined>(undefined);

  return (
    <BaseTimeView
      data={data}
      sortFn={sortFn}
      query={query}
      header={<TimeViewHeader sort={sortFn} onChangeSort={setSortFn} />}
      row={useMemo(() => timeViewRow(data), [data])}
    />
  );
};

const TimeViewHeader: FunctionComponent<{
  sort: SortFn<TableNode> | undefined;
  onChangeSort: (newFn: () => SortFn<TableNode> | undefined) => void;
}> = ({ sort, onChangeSort }) => (
  <div className={styles.row}>
    <div
      id="self-size-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sort === sortBySelfSize ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sort === sortBySelfSize ? undefined : sortBySelfSize)),
        [sort],
      )}
    >
      {sort === sortBySelfSize && <Icon i={ChevronDown} />}
      Self Size
    </div>
    <div
      id="retained-size-header"
      className={classes(styles.heading, styles.timing)}
      aria-sort={sort === sortByRetainedSize ? 'descending' : undefined}
      onClick={useCallback(
        () => onChangeSort(() => (sort === sortByRetainedSize ? undefined : sortByRetainedSize)),
        [sort],
      )}
    >
      {sort === sortByRetainedSize && <Icon i={ChevronDown} />}
      Retained Size
    </div>
  </div>
);

const BaseTimeViewRow = makeBaseTimeViewRow<TableNode>();

const timeViewRow =
  (data: DataProvider<TableNode>): FunctionComponent<IRowProps<TableNode>> =>
  props => {
    const { node } = props;
    const { selfSize, retainedSize } =
      node.parent ||
      data.loaded.reduce(
        (acc, n) => {
          acc.selfSize += n.selfSize;
          acc.retainedSize += n.retainedSize;
          return acc;
        },
        { selfSize: 0, retainedSize: 0 },
      );

    const vscode = useContext(VsCodeApi);
    const onClick = useCallback(
      (evt: MouseEvent) => {
        evt.stopPropagation();
        vscode.postMessage<IReopenWithEditor>({
          type: 'reopenWith',
          withQuery: `index=${node.index}`,
          toSide: true,
          viewType: 'jsProfileVisualizer.heapsnapshot.flame',
          requireExtension: 'ms-vscode.vscode-js-profile-flame',
        });
      },
      [vscode, node.index],
    );

    return (
      <BaseTimeViewRow
        {...props}
        virtual={false}
        onClick={onClick}
        rowText={
          <Fragment>
            {node.parent && (
              <a
                role="button"
                alt="View Retainer Graph"
                title="View Retainer Graph"
                onClick={onClick}
              >
                <Icon i={TypeHierarchySub} style={{ display: 'inline-block', width: '1em' }} />
              </a>
            )}{' '}
            {node.name}
            <span style={{ opacity: 0.5 }}>{node.parent ? ` @${node.id}` : ''}</span>
          </Fragment>
        }
      >
        <div className={styles.duration} aria-labelledby="self-size-header">
          <ImpactBar impact={node.selfSize / selfSize} />
          {prettyBytes(node.selfSize)}
        </div>
        <div className={styles.duration} aria-labelledby="retained-size-header">
          <ImpactBar impact={node.retainedSize / retainedSize} />
          {prettyBytes(node.retainedSize)}
        </div>
      </BaseTimeViewRow>
    );
  };
