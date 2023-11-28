/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import styles from './time-view.css';

export const ImpactBar: FunctionComponent<{ impact: number }> = ({ impact }) => (
  <div className={styles.impactBar} style={{ transform: `scaleX(${impact})` }} />
);

export default ImpactBar;
