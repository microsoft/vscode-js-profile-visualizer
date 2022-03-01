/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as Flame from '@vscode/codicons/src/icons/flame.svg';
import { Fragment, FunctionComponent, h, render } from 'preact';
import { useCallback, useContext, useMemo } from 'preact/hooks';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/common/types';
import { heapProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/heap/layout';
import { IProfileModel } from 'vscode-js-profile-core/out/esm/heap/model';
import { IQueryResults, PropertyType } from 'vscode-js-profile-core/out/esm/ql';
import styles from '../common/client.css';
import { IColumn } from '../common/types';
import { FlameGraph } from './flame-graph';
import { buildColumns, TreeNodeAccessor } from './stacks';

declare const MODEL: IProfileModel;

let timelineCols: IColumn[];
function getTimelineCols() {
  if (!timelineCols) {
    timelineCols = buildColumns(MODEL);
  }

  return timelineCols;
}

const CloseButton: FunctionComponent = () => {
  const vscode = useContext(VsCodeApi);
  const closeFlameGraph = useCallback(
    () =>
      vscode.postMessage<IReopenWithEditor>({
        type: 'reopenWith',
        viewType: 'jsProfileVisualizer.heapprofile.table',
        requireExtension: 'ms-vscode.vscode-js-profile-table',
      }),
    [vscode],
  );

  return (
    <ToggleButton icon={Flame} label="Show flame graph" checked={true} onClick={closeFlameGraph} />
  );
};

const HeapProfileLayout = heapProfileLayoutFactory<TreeNodeAccessor>();

const Root: FunctionComponent = () => {
  const FilterFooter: FunctionComponent = useCallback(
    () => (
      <Fragment>
        <CloseButton />{' '}
      </Fragment>
    ),
    [],
  );

  const cols = getTimelineCols();
  const FlameGraphWrapper: FunctionComponent<{
    data: IQueryResults<TreeNodeAccessor>;
  }> = useCallback(
    ({ data }) => {
      const filtered = useMemo(
        () => TreeNodeAccessor.getFilteredColumns(cols, data.selectedAndParents),
        [data],
      );
      return <FlameGraph model={MODEL} columns={cols} filtered={filtered} />;
    },
    [cols],
  );

  return (
    <HeapProfileLayout
      data={{
        data: TreeNodeAccessor.rootAccessors(cols),
        getChildren: n => n.children,
        genericMatchStr: n =>
          [n.callFrame.functionName, n.callFrame.url, n.src?.source.path ?? ''].join(' '),
        properties: {
          function: {
            type: PropertyType.String,
            accessor: n => n.callFrame.functionName,
          },
          url: {
            type: PropertyType.String,
            accessor: n => n.callFrame.url,
          },
          path: {
            type: PropertyType.String,
            accessor: n => n.src?.relativePath ?? n.callFrame.url,
          },
          line: {
            type: PropertyType.Number,
            accessor: n => (n.src ? n.src.lineNumber : n.callFrame.lineNumber),
          },
          selfTime: {
            type: PropertyType.Number,
            accessor: n => n.selfSize,
          },
          totalTime: {
            type: PropertyType.Number,
            accessor: n => n.totalSize,
          },
          id: {
            type: PropertyType.Number,
            accessor: n => n.id,
          },
        },
      }}
      body={FlameGraphWrapper}
      filterFooter={FilterFooter}
    />
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<Root />, container);
