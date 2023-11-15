/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as CaseSensitive from '@vscode/codicons/src/icons/case-sensitive.svg';
import * as Regex from '@vscode/codicons/src/icons/regex.svg';
import { ComponentChild, Fragment, FunctionComponent, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IDataSource, IQueryResults, evaluate } from '../ql';
import { Filter } from './filter';
import { FilterBar } from './filterBar';
import styles from './rich-filter.css';
import { ToggleButton } from './toggle-button';
import { usePersistedState } from './usePersistedState';

/**
 * Filter that the RichFilter returns,
 */
export interface IRichFilter {
  text: string;
  caseSensitive?: boolean;
  regex?: boolean;
}

/**
 * Compile the filter into a predicate function.
 */
export const compileFilter = (fn: IRichFilter): ((input: string) => boolean) => {
  if (fn.regex) {
    const re = new RegExp(fn.text, fn.caseSensitive ? '' : 'i');
    return input => re.test(input);
  }

  if (!fn.caseSensitive) {
    const test = fn.text.toLowerCase();
    return input => input.toLowerCase().includes(test);
  }

  return input => input.includes(fn.text);
};

export type RichFilterComponent<T> = FunctionComponent<{
  data: IDataSource<T>;
  placeholder: string;
  onChange: (data: IQueryResults<T>) => void;
  foot?: ComponentChild;
}>;

export const richFilter =
  <T,>(): RichFilterComponent<T> =>
  ({ placeholder, data, onChange, foot }) => {
    const [regex, setRegex] = useState(false);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [text, setText] = usePersistedState('filterText', '');
    const [error, setError] = useState<string | undefined>(undefined);

    useEffect(() => {
      try {
        onChange(
          evaluate({
            input: text,
            regex,
            caseSensitive,
            datasource: data,
          }),
        );
        setError(undefined);
      } catch (e) {
        setError((e as Error).message);
      }
    }, [regex, caseSensitive, text, data]);

    return (
      <FilterBar>
        <Filter
          value={text}
          placeholder={placeholder}
          onChange={setText}
          hasError={!!error}
          foot={
            <Fragment>
              <ToggleButton
                icon={CaseSensitive}
                label="Match Case"
                checked={caseSensitive}
                onChange={setCaseSensitive}
              />
              <ToggleButton
                icon={Regex}
                label="Use Regular Expression"
                checked={regex}
                onChange={setRegex}
              />
            </Fragment>
          }
        />
        {error && <div className={styles.error}>{error}</div>}
        {foot}
      </FilterBar>
    );
  };
