/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { promises as fs } from 'fs';
import { randomBytes } from 'crypto';

export const bundlePage = async (bundleFile: string, constants: { [key: string]: unknown }) => {
  const bundle = await fs.readFile(bundleFile, 'utf-8');
  const nonce = randomBytes(16).toString('hex');
  const constantDecls = Object.keys(constants)
    .map(key => `const ${key} = ${JSON.stringify(constants[key])};`)
    .join('\n');

  const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Custom Editor: ${bundleFile}</title>
    </head>
    <body>
      <script type="text/javascript" nonce="${nonce}">(() => {
        ${constantDecls}
        ${bundle}
      })();</script>
    </body>
    </html>
  `;

  return html;
};
