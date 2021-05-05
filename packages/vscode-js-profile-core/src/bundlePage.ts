/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

export const bundlePage = async (bundleUri: vscode.Uri, constants: { [key: string]: unknown }) => {
  const nonce = Math.random().toString();
  const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Profile Custom Editor</title>
    </head>
    <body>
      <script type="text/javascript" nonce="${nonce}">
        ${Object.entries(constants)
          .map(([key, value]) => `globalThis.${key} = ${JSON.stringify(value)}`)
          .join(';')}
      </script>
      <script nonce="${nonce}" src="${bundleUri}"></script>
    </body>
    </html>
  `;

  return html;
};
