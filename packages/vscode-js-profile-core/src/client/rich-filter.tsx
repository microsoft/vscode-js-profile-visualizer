/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent, Fragment, ComponentChild } from 'preact';
import { useState, useEffect, useContext } from 'preact/hooks';
import { Filter } from './filter';
import { ToggleButton } from './toggle-button';
import * as CaseSensitive from 'vscode-codicons/src/icons/case-sensitive.svg';
import * as Regex from 'vscode-codicons/src/icons/regex.svg';
import styles from './rich-filter.css';
import { evaluate, IDataSource } from '../ql';
import { VsCodeApi, IVscodeApi } from './vscodeApi';
import { useLazyEffect } from './useLazyEffect';

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
  getDefaultFilterText: (value: T) => ReadonlyArray<string>;
  onChange: (data: ReadonlyArray<T>) => void;
  foot?: ComponentChild;
}>;

export const richFilter = <T extends {}>(): RichFilterComponent<T> => ({
  placeholder,
  data,
  getDefaultFilterText,
  onChange,
  foot,
}) => {
  const vscode = useContext(VsCodeApi) as IVscodeApi<{ filterText: string }>;
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [text, setText] = useState(vscode.getState()?.filterText ?? '');
  const [error, setError] = useState<string | undefined>(undefined);

  useLazyEffect(() => {
    vscode.setState({ ...vscode.getState(), filterText: text });
  }, [text]);

  useEffect(() => {
    if (!text.includes('query()')) {
      const filter = compileFilter({ text, caseSensitive, regex });
      onChange(data.data.filter(d => getDefaultFilterText(d).some(filter)));
      return;
    }

    try {
      onChange(
        evaluate({
          expression: text,
          dataSources: { query: data },
        }),
      );
      setError(undefined);
    } catch (e) {
      setError(e.message);
    }
  }, [regex, caseSensitive, text]);

  return (
    <div className={styles.f}>
      <Filter
        value={text}
        placeholder={placeholder}
        onChange={setText}
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
    </div>
  );
};
