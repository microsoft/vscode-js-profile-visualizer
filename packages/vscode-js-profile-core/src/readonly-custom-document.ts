/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CustomDocument, Uri } from 'vscode';

export class ReadonlyCustomDocument<TData> implements CustomDocument {
  constructor(
    public readonly uri: Uri,
    public readonly userData: TData,
  ) {}

  /**
   * @inheritdoc
   */
  public dispose() {
    // no-op
  }
}
