/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IGraphNode, ILocation } from 'vscode-js-profile-core/out/esm/cpu/model';

export type SortFn = (node: ILocation) => number;

export type NodeAtDepth = { node: IGraphNode; depth: number; position: number };
