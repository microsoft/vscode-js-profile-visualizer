/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IJsDebugAnnotations } from './common/types';
import { addRelativeDiskPath, ISourceLocation } from './location-mapping';

export const getBestLocation = (
  profile: { $vscode?: IJsDebugAnnotations },
  candidates: ReadonlyArray<ISourceLocation> = [],
) => {
  if (!profile.$vscode?.rootPath) {
    return candidates[0];
  }

  for (const candidate of candidates) {
    const mapped = addRelativeDiskPath(profile.$vscode.rootPath, candidate);
    if (mapped.relativePath) {
      return mapped;
    }
  }

  return candidates[0];
};
