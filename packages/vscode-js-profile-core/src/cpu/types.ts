/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { ISourceLocation } from '../location-mapping';

export const enum Constants {
  CurrentDataVersion = 1,
}

export interface IAnnotationLocation {
  callFrame: Cdp.Runtime.CallFrame;
  locations: ISourceLocation[];
}

/**
 * Extra annotations added by js-debug.
 */
export interface IJsDebugAnnotations {
  /**
   * Workspace root path, if set.
   */
  rootPath?: string;

  /**
   * For each node in the profile, the list of locations in corresponds to
   * in the workspace (if any).
   */
  locations: ReadonlyArray<IAnnotationLocation>;

  /**
   * Optional cell data saved from previously opening the profile as a notebook.
   */
  cellData?: {
    version: number;
  };
}

export interface IProfileNode extends Cdp.Profiler.ProfileNode {
  locationId?: number;
  positionTicks?: (Cdp.Profiler.PositionTickInfo & {
    startLocationId?: number;
    endLocationId?: number;
  })[];
}

export interface ICpuProfileRaw extends Cdp.Profiler.Profile {
  $vscode?: IJsDebugAnnotations;
  nodes: IProfileNode[];
}
