/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { createContext } from 'preact';

/**
 * VS Code API exposed to webviews.
 */
export interface IVscodeApi<T = unknown> {
  getState(): T;
  setState(s: T): T;
  postMessage<M>(message: M): void;
}

declare const acquireVsCodeApi: () => IVscodeApi;

/**
 * Context key for the VS Code API object.
 */
export const VsCodeApi = createContext(acquireVsCodeApi());
