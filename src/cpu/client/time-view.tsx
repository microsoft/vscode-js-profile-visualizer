/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent, Fragment } from 'preact';
import styles from './time-view.css';
import { useMemo, useCallback, useContext, useState } from 'preact/hooks';
import { VsCodeApi } from '../../common/client/vscodeApi';
import { IProfileModel, ILocation } from '../model';
import { classes } from '../../common/client/util';
import { IOpenDocumentMessage } from '../types';
import * as ChevronDown from 'vscode-codicons/src/icons/chevron-down.svg';
import { Icon } from '../../common/client/icons';
import VirtualList from 'preact-virtual-list';

const decimalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

type SortFn = (node: ILocation) => number;

const selfTime: SortFn = n => n.selfTime;
const aggTime: SortFn = n => n.aggregateTime;

export const TimeView: FunctionComponent<{
  model: IProfileModel;
  filterFn: (input: string) => boolean;
}> = ({ model, filterFn }) => {
  const [sortFn, setSort] = useState(() => selfTime);

  const sorted = useMemo(
    () =>
      model.locations
        .filter(
          n =>
            filterFn(n.callFrame.functionName) ||
            filterFn(n.callFrame.url) ||
            filterFn(n.src?.source.path || ''),
        )
        .sort((a, b) => sortFn(b) - sortFn(a)),
    [model, filterFn, sortFn],
  );

  const renderRow = useCallback((row: ILocation) => <TimeViewRow {...row} />, []);

  return (
    <Fragment>
      <TimeViewHeader sortFn={sortFn} onChangeSort={setSort} />
      <VirtualList
        className={styles.rows}
        data={sorted}
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

const TimeViewRow: FunctionComponent<ILocation & { children?: ILocation[] }> = ({
  selfTime,
  aggregateTime,
  callFrame,
  src,
}) => {
  const vscode = useContext(VsCodeApi);
  const onClick = useCallback(
    (evt: MouseEvent) =>
      src &&
      src.source.path &&
      vscode.postMessage<IOpenDocumentMessage>({
        type: 'openDocument',
        path: src.source.path,
        lineNumber: src.lineNumber,
        columnNumber: src.columnNumber,
        toSide: evt.altKey,
      }),
    [vscode, src],
  );

  let location: string | undefined;
  if (!callFrame.url) {
    location = undefined; // 'virtual' frames like (program) or (idle)
  } else if (!src?.source.path) {
    location = `${callFrame.url}`;
    if (callFrame.lineNumber >= 0) {
      location += `:${callFrame.lineNumber}`;
    }
  } else if (src.relativePath) {
    location = `${src.relativePath}:${src.lineNumber}`;
  } else {
    location = `${src.source.path}:${src.lineNumber}`;
  }

  const func = callFrame.functionName || '(anonymous)';

  return (
    <div className={styles.row}>
      <div className={styles.duration}>{decimalFormat.format(selfTime / 1000)}ms</div>
      <div className={styles.duration}>{decimalFormat.format(aggregateTime / 1000)}ms</div>
      {!location ? (
        <div className={classes(styles.file, styles.virtual)}>{func}</div>
      ) : !src ? (
        <div className={styles.file}>
          {func} @ {location}
        </div>
      ) : (
        <div className={styles.file}>
          {func} @ <a onClick={onClick}>{location}</a>
        </div>
      )}
    </div>
  );
};
