/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { h, render } from 'preact'
import { Constants } from "./types";
import { IGraphNode } from "vscode-js-profile-core/out/cpu/model";
import { TimeView } from './table-view';

const renderTableTag = (tag: HTMLScriptElement) => {
  const graph: IGraphNode = JSON.parse(tag.innerHTML);
  const target = document.createElement('div');
  tag.replaceWith(target);
  render(<TimeView data={Object.values(graph)} />, target);
};

Object.assign(window, { renderTableTag });

const nodeList = document.querySelectorAll(`script[type="${Constants.TableMimeType}"]`);
for (let i = 0; i < nodeList.length; i++) {
  renderTableTag(nodeList[i] as HTMLScriptElement);
}
