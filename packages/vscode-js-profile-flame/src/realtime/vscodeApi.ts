/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FromWebViewMessage } from './protocol';

/**
 * VS Code API exposed to webviews.
 */
export interface IVscodeApi {
  postMessage(message: FromWebViewMessage): void;
}

declare const acquireVsCodeApi: () => IVscodeApi;

export const api = acquireVsCodeApi();
