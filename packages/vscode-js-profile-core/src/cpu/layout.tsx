/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { h, FunctionComponent, Fragment, ComponentType } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { IRichFilter, RichFilter, compileFilter } from '../client/rich-filter';
import styles from './layout.css';
import { IProfileModel } from './model';

declare const MODEL: IProfileModel;

export interface IBodyProps {
  filter: IRichFilter;
  filterFn: (input: string) => boolean;
  model: IProfileModel;
}

/**
 * Base layout component to display CPU-profile related info.
 */
export const CpuProfileLayout: FunctionComponent<{
  body: ComponentType<IBodyProps>;
  filterFooter?: ComponentType<{}>;
}> = ({ body: RowBody, filterFooter: FilterFooter }) => {
  const [filter, setFilter] = useState<IRichFilter>({ text: '' });
  const filterFn = useMemo(() => compileFilter(filter), [filter]);
  const footer = useMemo(() => (FilterFooter ? <FilterFooter /> : undefined), [FilterFooter]);

  return (
    <Fragment>
      <div className={styles.filter}>
        <RichFilter
          value={filter}
          onChange={setFilter}
          placeholder="Filter functions or files"
          foot={footer}
        />
      </div>
      <div className={styles.rows}>
        <RowBody filter={filter} filterFn={filterFn} model={MODEL} />
      </div>
    </Fragment>
  );
};
