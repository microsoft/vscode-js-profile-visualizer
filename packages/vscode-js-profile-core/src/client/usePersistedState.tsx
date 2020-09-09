/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { useContext, useState } from 'preact/hooks';
import { useLazyEffect } from './useLazyEffect';
import { IVscodeApi, VsCodeApi } from './vscodeApi';

/**
 * Like useState, but also persists changes to the VS Code webview API.
 */
export const usePersistedState = <T extends unknown>(key: string, defaultValue: T) => {
  const vscode = useContext(VsCodeApi) as IVscodeApi<{ [key: string]: T }>;
  const [value, setValue] = useState(vscode.getState()?.[key] ?? defaultValue);

  useLazyEffect(() => {
    vscode.setState({ ...vscode.getState(), [key]: value });
  }, [value]);

  return [value, setValue] as const;
};
