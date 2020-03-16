/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as path from 'path';

/**
 * Resolves path segments properly based on whether they appear to be c:/ -style or / style.
 */
export function properRelative(fromPath: string, toPath: string): string {
  if (path.posix.isAbsolute(fromPath)) {
    return path.posix.relative(fromPath, toPath);
  } else if (path.win32.isAbsolute(fromPath)) {
    return path.win32.relative(fromPath, toPath);
  } else {
    return path.relative(fromPath, toPath);
  }
}
