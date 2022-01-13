/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { ISourceLocation } from '../location-mapping';

/**
 * Category of call frames. Grouped into system, modules, and user code.
 */
export const enum Category {
  System,
  User,
  Module,
  Deemphasized,
}

export interface INode {
  id: number;
  category: Category;
  callFrame: Cdp.Runtime.CallFrame;
  src?: ISourceLocation;
}

export interface ICommonNode extends INode {
  children: { [id: number]: ICommonNode };
  childrenSize: number;
  parent?: ICommonNode;
}

/**
 * Categorizes the given call frame.
 */
export const categorize = (callFrame: Cdp.Runtime.CallFrame, src: ISourceLocation | undefined) => {
  callFrame.functionName = callFrame.functionName || '(anonymous)';
  if (callFrame.lineNumber < 0) {
    return Category.System;
  }

  if (callFrame.url.includes('node_modules') || !src) {
    return Category.Module;
  }

  return Category.User;
};
