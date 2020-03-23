/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { h, render, FunctionComponent, Fragment } from 'preact';
import { useState, useMemo, useCallback, useContext } from 'preact/hooks';
import {
  IRichFilter,
  RichFilter,
  compileFilter,
} from 'vscode-js-profile-core/out/esm/client/rich-filter';
import { TimeView } from './time-view';
import styles from './client.css';
import { IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import { createBottomUpGraph } from './bottomUpGraph';
import * as Flame from 'vscode-codicons/src/icons/flame.svg';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/cpu/types';

declare const MODEL: IProfileModel;

const bottomUp = createBottomUpGraph(MODEL);

const App: FunctionComponent = () => {
  const [filter, setFilter] = useState<IRichFilter>({ text: '' });
  const filterFn = useMemo(() => compileFilter(filter), [filter]);

  const vscode = useContext(VsCodeApi);
  const openFlameGraph = useCallback(
    () =>
      vscode.postMessage<IReopenWithEditor>({
        type: 'reopenWith',
        viewType: 'jsProfileVisualizer.cpuprofile.flame',
        requireExtension: 'ms-vscode.vscode-js-profile-flame',
      }),
    [vscode],
  );

  return (
    <Fragment>
      <div className={styles.filter}>
        <RichFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filter functions or files"
          foot={
            <ToggleButton
              icon={Flame}
              label="Show flame graph"
              checked={false}
              onClick={openFlameGraph}
            />
          }
        />
      </div>
      <div className={styles.rows}>
        <TimeView graph={bottomUp} filterFn={filterFn} />
      </div>
    </Fragment>
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<App />, container);
