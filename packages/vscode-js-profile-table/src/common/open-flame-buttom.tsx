/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FunctionComponent, h } from 'preact';
import { useCallback, useContext } from 'preact/hooks';
import * as Flame from 'vscode-codicons/src/icons/flame.svg';
import { ToggleButton } from 'vscode-js-profile-core/out/esm/client/toggle-button';
import { VsCodeApi } from 'vscode-js-profile-core/out/esm/client/vscodeApi';
import { IReopenWithEditor } from 'vscode-js-profile-core/out/esm/cpu/types';

const OpenFlameButton: FunctionComponent<{ viewType: string; requireExtension: string }> = ({
  viewType,
  requireExtension,
}) => {
  const vscode = useContext(VsCodeApi);
  const closeFlameGraph = useCallback(
    () =>
      vscode.postMessage<IReopenWithEditor>({
        type: 'reopenWith',
        viewType,
        requireExtension,
      }),
    [vscode],
  );

  return (
    <ToggleButton icon={Flame} label="Show flame graph" checked={false} onClick={closeFlameGraph} />
  );
};

export default OpenFlameButton;
