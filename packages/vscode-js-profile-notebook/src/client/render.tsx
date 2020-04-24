/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, render } from 'preact';
import { Constants } from '../types';
import { IGraphNode } from 'vscode-js-profile-core/out/cpu/model';
import { TimeView } from './table-view';

export const renderTableTag = (tag: HTMLScriptElement) => {
  let target: HTMLElement;
  if (tag.nextElementSibling?.classList.contains('js-debug-table')) {
    target = tag.nextElementSibling as HTMLElement;
  } else {
    target = document.createElement('div');
    target.classList.add('js-debug-table');
    tag.parentNode?.insertBefore(target, tag.nextSibling);
  }

  const graph: IGraphNode = JSON.parse(tag.innerHTML);
  render(<TimeView data={Object.values(graph)} />, target);
};

export const renderAllTables = () => {
  const nodeList = document.querySelectorAll(`script[type="${Constants.TableMimeType}"]`);
  for (let i = 0; i < nodeList.length; i++) {
    renderTableTag(nodeList[i] as HTMLScriptElement);
  }
};
