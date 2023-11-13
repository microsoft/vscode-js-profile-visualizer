/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ICommonNode } from 'vscode-js-profile-core/out/esm/common/model';

export default (node: ICommonNode) => {
  const parts = [node.id];
  for (let n = node.parent; n; n = n.parent) {
    parts.push(n.id);
  }

  return parts.join('-');
};
