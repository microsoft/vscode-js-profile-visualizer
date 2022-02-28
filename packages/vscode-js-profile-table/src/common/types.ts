/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILocation } from 'vscode-js-profile-core/out/esm/cpu/model';
import { IHeapProfileNode } from 'vscode-js-profile-core/out/esm/heap/model';

export type SortFn = (node: ILocation | IHeapProfileNode) => number;
