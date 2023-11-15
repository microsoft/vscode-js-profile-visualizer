/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { FunctionComponent, h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { PageLoader } from 'vscode-js-profile-core/out/esm/client/pageLoader';
import { cpuProfileLayoutFactory } from 'vscode-js-profile-core/out/esm/cpu/layout';
import { GraphRPCInterface } from 'vscode-js-profile-core/out/esm/heapsnapshot/rpc';
import { useGraph } from 'vscode-js-profile-core/out/esm/heapsnapshot/useGraph';
import { DataProvider, IQueryResults, PropertyType } from 'vscode-js-profile-core/out/esm/ql';
import styles from '../common/client.css';
import OpenFlameButton from '../common/open-flame-buttom';
import { SortFn } from '../common/types';
import { TableNode, TimeView, sortByName, sortBySelfSize } from './time-view';

const TimeViewWrapper: FunctionComponent<{
  query: IQueryResults<TableNode>;
  data: DataProvider<TableNode>;
}> = ({ query, data }) => <TimeView query={query} data={data} />;

const CpuProfileLayout = cpuProfileLayoutFactory<TableNode>();

const convertSorter = (sort?: SortFn<TableNode>): number => {
  /** Mirror of WasmSortBy in the v8_heap_parser.d.ts, but we don't want to import the wasm here */
  const enum WasmSortBy {
    SelfSize = 0,
    RetainedSize = 1,
    Name = 2,
  }

  if (sort === sortBySelfSize) {
    return WasmSortBy.SelfSize;
  } else if (sort === sortByName) {
    return WasmSortBy.Name;
  } else {
    return WasmSortBy.RetainedSize;
  }
};

const makeNestedDataProvider = (
  parent: TableNode,
  graph: GraphRPCInterface,
): DataProvider<TableNode> =>
  new DataProvider<TableNode>(
    parent.childrenLen,
    (start, end, sort) =>
      ('type' in parent
        ? graph.getNodeChildren(parent.index, start, end, convertSorter(sort))
        : graph.getClassChildren(parent.index, start, end, convertSorter(sort))
      ).then((items: TableNode[]) => {
        for (const item of items) {
          item.parent = parent;
        }
        return items;
      }),
    n => makeNestedDataProvider(n, graph),
  );

const Root: FunctionComponent = () => {
  const graph = useGraph();
  const [classGroups, setClassGroups] = useState<TableNode[] | Error | undefined>(undefined);

  useEffect(() => {
    graph
      .getClassGroups(0, 10_000)
      .then(items => items.map(item => ({ ...item, id: item.index })))
      .then(setClassGroups, setClassGroups);
  }, []);

  if (classGroups === undefined) {
    return <PageLoader />;
  }
  if (classGroups instanceof Error) {
    return <div>{String(classGroups)}</div>;
  }

  return (
    <CpuProfileLayout
      data={{
        data: DataProvider.fromTopLevelArray(classGroups, n => makeNestedDataProvider(n, graph)),
        genericMatchStr: n => `${n.name} ${n.id}`,
        properties: {
          object: {
            type: PropertyType.String,
            accessor: n => n.name,
          },
          selfSize: {
            type: PropertyType.Number,
            accessor: n => n.selfSize,
          },
          retainedSize: {
            type: PropertyType.Number,
            accessor: n => n.retainedSize,
          },
          id: {
            type: PropertyType.Number,
            accessor: n => n.id,
          },
        },
      }}
      body={TimeViewWrapper}
      filterFooter={OpenFlameButton}
    />
  );
};

const container = document.createElement('div');
container.classList.add(styles.wrapper);
document.body.appendChild(container);
render(<Root />, container);
