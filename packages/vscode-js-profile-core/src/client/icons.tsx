/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';

export const Icon: FunctionComponent<{ i: string } & h.JSX.HTMLAttributes> = ({ i, ...props }) => (
  <span
    dangerouslySetInnerHTML={{ __html: i }}
    style={{ color: 'var(--vscode-icon-foreground)' }}
    {...props}
  />
);
