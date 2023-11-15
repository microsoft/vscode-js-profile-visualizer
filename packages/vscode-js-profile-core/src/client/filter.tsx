/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ComponentChild, FunctionComponent, h } from 'preact';
import { useCallback } from 'preact/hooks';
import styles from './filter.css';
import { classes } from './util';

/**
 * Bar that allows filtering of the data. Can contain "footer" buttons.
 */
export const Filter: FunctionComponent<{
  value: string;
  type?: string;
  min?: number;
  hasError?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  foot?: ComponentChild;
}> = ({ value, hasError, min, type, onChange, placeholder = 'Filter for function', foot }) => {
  const onChangeRaw = useCallback(
    (evt: Event) => {
      onChange((evt.target as HTMLInputElement).value);
    },
    [onChange],
  );

  return (
    <div className={styles.wrapper}>
      <input
        className={classes(hasError && styles.error)}
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onPaste={onChangeRaw}
        onKeyUp={onChangeRaw}
      />
      {foot}
    </div>
  );
};
