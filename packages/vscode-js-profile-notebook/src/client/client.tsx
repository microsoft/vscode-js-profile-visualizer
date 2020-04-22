/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { renderTableTag, renderAllTables } from './render';

function init() {
  Object.assign(window, { renderTableTag });
  renderAllTables();
}

init();

declare const module: { hot?: { accept(deps: string[], callback: () => void): void } };

if (module.hot) {
  module.hot.accept(['./render'], init);
}
