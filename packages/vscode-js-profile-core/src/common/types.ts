/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { GraphRPCCall } from '../heapsnapshot/rpc';
import { ISourceLocation } from '../location-mapping';

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

/**
 * Request from the webview to open a document
 */
export interface IOpenDocumentMessage {
  type: 'openDocument';
  location?: ISourceLocation;
  callFrame?: Cdp.Runtime.CallFrame;
  toSide: boolean;
}

/**
 * Reopens the current document with the given editor, optionally only if
 * the given extension is installed.
 */
export interface IReopenWithEditor {
  type: 'reopenWith';
  viewType: string;
  toSide?: boolean;
  withQuery?: string;
  requireExtension?: string;
}

/**
 * Reopens the current document with the given editor, optionally only if
 * the given extension is installed.
 */
export interface IRunCommand {
  type: 'command';
  command: string;
  args: unknown[];
  requireExtension?: string;
}

/**
 * Calls a graph method, used in the heapsnapshot.
 */
export interface ICallHeapGraph {
  type: 'callGraph';
  inner: GraphRPCCall;
}

export type Message = IOpenDocumentMessage | IRunCommand | IReopenWithEditor | ICallHeapGraph;
