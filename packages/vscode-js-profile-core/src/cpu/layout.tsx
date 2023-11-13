/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { ComponentType, Fragment, FunctionComponent, h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { RichFilterComponent, richFilter } from '../client/rich-filter';
import styles from '../common/layout.css';
import { DataProvider, IDataSource, IQueryResults } from '../ql';

export interface IBodyProps<T> {
  query: IQueryResults<T>;
  data: DataProvider<T>;
}

type CpuProfileLayoutComponent<T> = FunctionComponent<{
  data: IDataSource<T>;
  body: ComponentType<IBodyProps<T>>;
  filterFooter?: ComponentType<{ viewType: string; requireExtension: string }>;
}>;

/**
 * Base layout component to display CPU-profile related info.
 */
export const cpuProfileLayoutFactory = <T,>(): CpuProfileLayoutComponent<T> => {
  const CpuProfileLayout: CpuProfileLayoutComponent<T> = ({
    data,
    body: RowBody,
    filterFooter: FilterFooter,
  }) => {
    const RichFilter = useMemo<RichFilterComponent<T>>(richFilter, []);
    const [filteredData, setFilteredData] = useState<IQueryResults<T> | undefined>(undefined);
    const footer = useMemo(
      () =>
        FilterFooter ? (
          <FilterFooter
            viewType="jsProfileVisualizer.cpuprofile.flame"
            requireExtension="ms-vscode.vscode-js-profile-flame"
          />
        ) : undefined,
      [FilterFooter],
    );

    return (
      <Fragment>
        <div className={styles.filter}>
          <RichFilter
            data={data}
            onChange={setFilteredData}
            placeholder="Filter functions or files, or start a query()"
            foot={footer}
          />
        </div>
        <div className={styles.rows}>
          {filteredData && <RowBody query={filteredData} data={data.data} />}
        </div>
      </Fragment>
    );
  };
  return CpuProfileLayout;
};
