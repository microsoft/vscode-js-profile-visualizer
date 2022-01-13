/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { INode } from './model';

/**
 * Gets the human-readable label for the given node.
 */
export const getNodeText = (node: INode) => {
  if (!node.callFrame.url) {
    return; // 'virtual' frames like (program) or (idle)
  }

  if (!node.src?.source.path) {
    let text = `${node.callFrame.url}`;
    if (node.callFrame.lineNumber >= 0) {
      text += `:${node.callFrame.lineNumber}`;
    }

    return text;
  }

  if (node.src.relativePath) {
    return `${node.src.relativePath}:${node.src.lineNumber}`;
  }

  return `${node.src.source.path}:${node.src.lineNumber}`;
};

export const decimalFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
