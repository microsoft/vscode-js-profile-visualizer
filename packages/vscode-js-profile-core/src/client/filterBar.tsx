/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import styles from './filterBar.css';

export const FilterBar: FunctionComponent = ({ children }) => (
  <div className={styles.f}>{children}</div>
);
