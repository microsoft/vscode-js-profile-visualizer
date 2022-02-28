/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { FunctionComponent, h, render } from 'preact';
import { createBottomUpGraph } from 'vscode-js-profile-core/out/esm/cpu/bottomUpGraph';
import { cpuProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { IGraphNode, IProfileModel } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IQueryResults, PropertyType } from 'vscode-js-profile-core/out/esm/ql';
import styles from '../common/client.css';
import OpenFlameButton from '../common/open-flame-buttom';
import { TimeView } from './time-view';

declare const MODEL: IProfileModel;

const graph = createBottomUpGraph(MODEL);

const allChildren = Object.values(graph.children);
const TimeViewWrapper: FunctionComponent<{
  data: IQueryResults<IGraphNode>;
}> = ({ data }) => <TimeView query={data} data={allChildren} />;

const CpuProfileLayout = cpuProfileLayoutFactory<IGraphNode>();

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(
  <CpuProfileLayout
    data={{
      data: allChildren,
      getChildren: n => Object.values(n.children),
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
    body={TimeViewWrapper}
    filterFooter={OpenFlameButton}
  />,
  container,
);
