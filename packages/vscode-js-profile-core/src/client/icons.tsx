/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, FunctionComponent } from 'preact';

export const formatCodicon = (svg: string) =>
  svg.replace(/fill="#[a-z0-f]{3,6}"/gi, 'fill="currentColor"');

export const Icon: FunctionComponent<{ i: string }> = ({ i }) => (
  <span dangerouslySetInnerHTML={{ __html: formatCodicon(i) }} />
);
