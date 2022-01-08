/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ITreeNode } from './model';

/**
 * Gets the human-readable label for the given location.
 */
export const getNodeText = (node: ITreeNode) => {
  if (!node.callFrame.url) {
    return; // 'virtual' frames like (program) or (idle)
  }

  let text = `${node.callFrame.url}`;
  if (node.callFrame.lineNumber >= 0) {
    text += `:${node.callFrame.lineNumber}`;
  }

  return text;
};

export const decimalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
