/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CustomDocument, Uri } from 'vscode';

export class ReadonlyCustomDocument<TData> extends CustomDocument {
  constructor(uri: Uri, public readonly userData: TData) {
    super(uri);
  }
}
