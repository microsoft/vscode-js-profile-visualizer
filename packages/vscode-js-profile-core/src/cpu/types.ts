/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { IJsDebugAnnotations } from '../common/types';

export const enum Constants {
  CurrentDataVersion = 1,
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
