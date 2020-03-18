/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { h, render, FunctionComponent, Fragment } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { IRichFilter, RichFilter, compileFilter } from '../common/client/rich-filter';
import { TimeView } from './client/time-view';
import styles from './client.css';
import { IProfileModel } from './model';
import { createBottomUpGraph } from './bottomUpGraph';

declare const MODEL: IProfileModel;

const bottomUp = createBottomUpGraph(MODEL);

const App: FunctionComponent = () => {
  const [filter, setFilter] = useState<IRichFilter>({ text: '' });
  const filterFn = useMemo(() => compileFilter(filter), [filter]);

  return (
    <Fragment>
      <div className={styles.filter}>
        <RichFilter value={filter} onChange={setFilter} placeholder="Filter functions or files" />
      </div>
      <div className={styles.rows}>
        <TimeView model={MODEL} graph={bottomUp} filterFn={filterFn} />
      </div>
    </Fragment>
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<App />, container);
