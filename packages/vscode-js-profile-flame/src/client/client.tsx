/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { Fragment, FunctionComponent, h, render } from 'preact';
import { useCallback, useContext, useMemo, useState } from 'preact/hooks';
import * as LeftHeavyIcon from 'vscode-codicons/src/icons/debug-breakpoint-data.svg';
import * as Flame from 'vscode-codicons/src/icons/flame.svg';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { cpuProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/cpu/types';
import { IQueryResults, PropertyType } from 'vscode-js-profile-core/out/esm/ql';
import styles from './client.css';
import { FlameGraph } from './flame-graph';
import { buildColumns, buildLeftHeavyColumns, IColumn, LocationAccessor } from './stacks';

declare const MODEL: IProfileModel;

let timelineCols: IColumn[];
function getTimelineCols() {
  if (!timelineCols) {
    timelineCols = buildColumns(MODEL);
  }

  return timelineCols;
}

let leftHeavyCols: IColumn[];
function getLeftHeavyCols() {
  if (!leftHeavyCols) {
    return buildLeftHeavyColumns(MODEL);
  }

  return leftHeavyCols;
}

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

const CpuProfileLayout = cpuProfileLayoutFactory<LocationAccessor>();

const Root: FunctionComponent = () => {
  const [leftHeavy, setLeftHeavy] = useState(false);

  const FilterFooter: FunctionComponent = useCallback(
    () => (
      <Fragment>
        <ToggleButton
          icon={LeftHeavyIcon}
          label="Toggle left-heavy view"
          checked={leftHeavy}
          onClick={() => setLeftHeavy(!leftHeavy)}
        />
        <CloseButton />{' '}
      </Fragment>
    ),
    [leftHeavy],
  );

  const cols = leftHeavy ? getLeftHeavyCols() : getTimelineCols();

  const FlameGraphWrapper: FunctionComponent<{
    data: IQueryResults<LocationAccessor>;
  }> = useCallback(
    ({ data }) => {
      const filtered = useMemo(
        () => LocationAccessor.getFilteredColumns(cols, data.selectedAndParents),
        [data],
      );
      return <FlameGraph model={MODEL} columns={cols} filtered={filtered} />;
    },
    [cols],
  );

  return (
    <CpuProfileLayout
      data={{
        data: LocationAccessor.rootAccessors(cols),
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
            accessor: n => n.selfTime,
          },
          totalTime: {
            type: PropertyType.Number,
            accessor: n => n.aggregateTime,
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
