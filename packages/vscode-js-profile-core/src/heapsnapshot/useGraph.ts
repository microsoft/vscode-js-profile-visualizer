/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { useContext, useMemo } from 'preact/hooks';
import { IVscodeApi, VsCodeApi } from '../client/vscodeApi';
import { ICallHeapGraph } from '../common/types';
import { GraphRPCInterface, GraphRPCResult } from './rpc';

// intentionally global to prevent hooks from clobbering each other
let callNo = Math.floor(Math.random() * 0x7fffffff);

/* eslint-disable @typescript-eslint/no-explicit-any */

export const doGraphRpc = (vscode: IVscodeApi, method: string, args: unknown[]) => {
  const id = callNo++;

  vscode.postMessage<ICallHeapGraph>({
    type: 'callGraph',
    inner: { method: method, args, id } as any,
  });

  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<{ method: string; message: GraphRPCResult }>) => {
      if (event.data?.method === 'graphRet' && event.data.message.id === id) {
        window.removeEventListener('message', listener);

        const result = event.data.message.result;
        if ('ok' in result) {
          resolve(result.ok);
        } else {
          reject(new Error(result.err));
        }
      }
    };

    window.addEventListener('message', listener);
  });
};

/** Exposes the graph RPC interface to the component. */
export const useGraph = (): GraphRPCInterface => {
  const vscode = useContext(VsCodeApi) as IVscodeApi;

  return useMemo(
    () =>
      new Proxy(
        {},
        {
          get:
            (_, method: keyof GraphRPCInterface) =>
            (...args: unknown[]) =>
              doGraphRpc(vscode, method, args),
        },
      ) as GraphRPCInterface,
    [],
  );
};
