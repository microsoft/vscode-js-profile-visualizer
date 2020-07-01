/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
  CodeLens,
  Disposable,
  EventEmitter,
  CodeLensProvider,
  TextDocument,
  ProviderResult,
} from 'vscode';
import { lowerCaseInsensitivePath } from './path';
import { DownloadFileProvider } from './download-file-provider';
import { ProfileAnnotations } from './profileAnnotations';

/**
 * Shows code lens information for the currently active profile.
 */
export class ProfileCodeLensProvider implements CodeLensProvider {
  private readonly changeEmitter = new EventEmitter<void>();
  private lenses?: ProfileAnnotations;

  /**
   * @inheritdoc
   */
  public onDidChangeCodeLenses = this.changeEmitter.event;

  /**
   * Updates the set of lenses currently being displayed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerLenses(lenses: ProfileAnnotations): Disposable {
    this.lenses = lenses;

    return {
      dispose: () => {
        if (this.lenses === lenses) {
          this.lenses = undefined;
          this.changeEmitter.fire();
        }
      },
    };
  }

  /**
   * Clears the current set of profiling lenses.
   */
  public clear() {
    this.lenses = undefined;
    this.changeEmitter.fire();
  }

  /**
   * @inheritdoc
   */
  public provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
    const byPath = this.lenses?.getLensesForFile(lowerCaseInsensitivePath(document.uri.fsPath));
    if (byPath) {
      return byPath;
    }

    const byUrl =
      document.uri.scheme === DownloadFileProvider.scheme
        ? this.lenses?.getLensesForFile(document.uri.query)
        : undefined;
    if (byUrl) {
      return byUrl;
    }

    return [];
  }
}
