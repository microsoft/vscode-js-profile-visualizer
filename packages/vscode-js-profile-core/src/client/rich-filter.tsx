/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ComponentChild, Fragment, FunctionComponent, h } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import * as CaseSensitive from 'vscode-codicons/src/icons/case-sensitive.svg';
import * as Regex from 'vscode-codicons/src/icons/regex.svg';
import { evaluate, IDataSource, IQueryResults } from '../ql';
import { Filter } from './filter';
import styles from './rich-filter.css';
import { ToggleButton } from './toggle-button';
import { useLazyEffect } from './useLazyEffect';
import { IVscodeApi, VsCodeApi } from './vscodeApi';

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

export const richFilter = <T extends {}>(): RichFilterComponent<T> => ({
  placeholder,
  data,
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
      setError(e.message);
    }
  }, [regex, caseSensitive, text, data]);

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
