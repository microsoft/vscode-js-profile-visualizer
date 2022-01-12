/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IGraphNode } from 'vscode-js-profile-core/out/esm/cpu/model';
import { ITreeNode } from 'vscode-js-profile-core/out/esm/heap/model';

export default (node: IGraphNode | ITreeNode) => {
  const parts = [node.id];
  for (let n = node.parent; n; n = n.parent) {
    parts.push(n.id);
  }

  return parts.join('-');
};
