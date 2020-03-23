/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { h, render, FunctionComponent } from 'preact';
import { useCallback, useContext } from 'preact/hooks';
import styles from './client.css';
import * as Flame from 'vscode-codicons/src/icons/flame.svg';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/cpu/types';
import { CpuProfileLayout } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { FlameGraph } from './flame-graph';

const CloseButton: FunctionComponent = () => {
  const vscode = useContext(VsCodeApi);
  const closeFlameGraph = useCallback(
    () =>
      vscode.postMessage<IReopenWithEditor>({
        type: 'reopenWith',
        viewType: 'jsProfileVisualizer.cpuprofile.table',
        requireExtension: 'ms-vscode.vscode-js-profile-table',
      }),
    [vscode],
  );

  return (
    <ToggleButton icon={Flame} label="Show flame graph" checked={true} onClick={closeFlameGraph} />
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<CpuProfileLayout body={FlameGraph} filterFooter={CloseButton} />, container);
