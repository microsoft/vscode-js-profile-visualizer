/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { ComponentType, Fragment, FunctionComponent, h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { richFilter, RichFilterComponent } from '../client/rich-filter';
import { IDataSource, IQueryResults } from '../ql';
import styles from './layout.css';

export interface IBodyProps<T> {
  data: IQueryResults<T>;
}

type HeapProfileLayoutComponent<T> = FunctionComponent<{
  data: IDataSource<T>;
  body: ComponentType<IBodyProps<T>>;
  filterFooter?: ComponentType<{ viewType: string; requireExtension: string }>;
}>;

/**
 * Base layout component to display CPU-profile related info.
 */
export const heapProfileLayoutFactory =
  <T extends {}>(): HeapProfileLayoutComponent<T> =>
  ({ data, body: RowBody, filterFooter: FilterFooter }) => {
    const RichFilter = useMemo<RichFilterComponent<T>>(richFilter, []);
    const [filteredData, setFilteredData] = useState<IQueryResults<T> | undefined>(undefined);
    const footer = useMemo(
      () =>
        FilterFooter ? (
          <FilterFooter
            viewType="jsProfileVisualizer.heapprofile.flame"
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
        <div className={styles.rows}>{filteredData && <RowBody data={filteredData} />}</div>
      </Fragment>
    );
  };
