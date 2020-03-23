/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent, Fragment, ComponentChild } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Filter } from './filter';
import { ToggleButton } from './toggle-button';
import * as CaseSensitive from 'vscode-codicons/src/icons/case-sensitive.svg';
import * as Regex from 'vscode-codicons/src/icons/regex.svg';
import styles from './rich-filter.css';

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

export const RichFilter: FunctionComponent<{
  placeholder: string;
  value: IRichFilter;
  onChange: (value: IRichFilter) => void;
  foot?: ComponentChild;
}> = ({ placeholder, value, onChange, foot }) => {
  const [regex, setRegex] = useState(!!value.regex);
  const [caseSensitive, setCaseSensitive] = useState(!!value.caseSensitive);
  const [text, setText] = useState(value.text);

  useEffect(() => {
    onChange({ regex, caseSensitive, text });
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
      {foot}
    </div>
  );
};
