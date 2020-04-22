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
import { cpuProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { IProfileModel, IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import { createBottomUpGraph } from 'vscode-js-profile-core/out/esm/cpu/bottomUpGraph';
import { TimeView } from './time-view';

declare const MODEL: IProfileModel;

const graph = createBottomUpGraph(MODEL);

const OpenGraphButton: FunctionComponent = () => {
  const vscode = useContext(VsCodeApi);
  const closeFlameGraph = useCallback(
    () =>
      vscode.postMessage<IReopenWithEditor>({
        type: 'reopenWith',
        viewType: 'jsProfileVisualizer.cpuprofile.flame',
        requireExtension: 'ms-vscode.vscode-js-profile-flame',
      }),
    [vscode],
  );

  return (
    <ToggleButton icon={Flame} label="Show flame graph" checked={false} onClick={closeFlameGraph} />
  );
};

const CpuProfileLayout = cpuProfileLayoutFactory<IGraphNode>();

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(
  <CpuProfileLayout
    data={{
      data: Object.values(graph.children),
      properties: {
        function: 'node.callFrame.functionName',
        url: 'node.callFrame.url',
        line: '(node.src ? node.src.lineNumber : node.callFrame.lineNumber)',
        path: '(node.src ? node.src.relativePath : node.callFrame.url)',
        selfTime: 'node.selfTime',
        totalTime: 'node.aggregateTime',
        id: 'node.id',
      },
      getChildren: 'return Object.values(node.children)',
    }}
    getDefaultFilterText={node => [
      node.callFrame.functionName,
      node.callFrame.url,
      node.src?.source.path ?? '',
    ]}
    body={TimeView}
    filterFooter={OpenGraphButton}
  />,
  container,
);
