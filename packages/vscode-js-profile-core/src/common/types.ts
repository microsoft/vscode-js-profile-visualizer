/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { ISourceLocation } from '../location-mapping';

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
  requireExtension?: string;
}

export type Message = IOpenDocumentMessage | IReopenWithEditor;
