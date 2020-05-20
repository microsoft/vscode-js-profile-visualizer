/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { h, render, FunctionComponent } from 'preact';
import { useCallback, useContext, useMemo } from 'preact/hooks';
import styles from './client.css';
import * as Flame from 'vscode-codicons/src/icons/flame.svg';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { cpuProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/cpu/types';
import { IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import { FlameGraph } from './flame-graph';
import { buildColumns, LocationAccessor } from './stacks';

declare const MODEL: IProfileModel;
const columns = buildColumns(MODEL);

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

const FlameGraphWrapper: FunctionComponent<{ data: ReadonlyArray<LocationAccessor> }> = ({
  data,
}) => {
  const filtered = useMemo(() => LocationAccessor.getFilteredColumns(columns, data), [data]);
  return <FlameGraph model={MODEL} columns={filtered} />;
};

const CpuProfileLayout = cpuProfileLayoutFactory<LocationAccessor>();

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(
  <CpuProfileLayout
    data={{
      data: LocationAccessor.rootAccessors(columns),
      getChildren: 'return node.children',
      properties: {
        function: 'node.callFrame.functionName',
        url: 'node.callFrame.url',
        line: '(node.src ? node.src.lineNumber : node.callFrame.lineNumber)',
        path: '(node.src ? node.src.relativePath : node.callFrame.url)',
        selfTime: 'node.selfTime',
        totalTime: 'node.aggregateTime',
        id: 'node.id',
      },
    }}
    getDefaultFilterText={node => [
      node.callFrame.functionName,
      node.callFrame.url,
      node.src?.source.path ?? '',
    ]}
    body={FlameGraphWrapper}
    filterFooter={CloseButton}
  />,
  container,
);
