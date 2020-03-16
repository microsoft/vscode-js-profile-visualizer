/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { DebugProtocol as Dap } from 'vscode-debugprotocol';

export const enum Constants {
  CurrentDataVersion = 1,
}

export interface ISourceLocation {
  lineNumber: number;
  columnNumber: number;
  source: Dap.Source;
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
  locations?: ReadonlyArray<null | ReadonlyArray<ISourceLocation>>;

  /**
   * Optional cell data saved from previously opening the profile as a notebook.
   */
  cellData?: {
    version: number;
  };
}

export interface ICpuProfileRaw extends Cdp.Profiler.Profile {
  $vscode?: IJsDebugAnnotations;
}

/**
 * Request from the webview to open a document
 */
export interface IOpenDocumentMessage {
  type: 'openDocument';
  path: string;
  lineNumber: number;
  columnNumber: number;
  toSide: boolean;
}

export type Message = IOpenDocumentMessage;
