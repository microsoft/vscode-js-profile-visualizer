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
import { LensCollection } from './lens-collection';
import { DownloadFileProvider } from './download-file-provider';

/**
 * Shows code lens information for the currently active profile.
 */
export class ProfileCodeLensProvider implements CodeLensProvider {
  private readonly changeEmitter = new EventEmitter<void>();
  private lenses?: { [file: string]: CodeLens[] };

  /**
   * @inheritdoc
   */
  public onDidChangeCodeLenses = this.changeEmitter.event;

  /**
   * Updates the set of lenses currently being displayed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerLenses(lenses: LensCollection<any>): Disposable {
    this.setLenses(lenses);
    const current = this.lenses;

    return {
      dispose: () => {
        if (this.lenses === current) {
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
    const byPath = this.lenses?.[lowerCaseInsensitivePath(document.uri.fsPath)];
    if (byPath) {
      return byPath;
    }

    const byUrl =
      document.uri.scheme === DownloadFileProvider.scheme
        ? this.lenses?.[document.uri.query]
        : undefined;
    if (byUrl) {
      return byUrl;
    }

    return [];
  }

  private setLenses(collection: LensCollection<void>) {
    this.lenses = {};

    for (const file of collection.files()) {
      const lenses: CodeLens[] = [];
      for (const lens of collection.getLensesForFile(file)) {
        lenses.push(
          lens,
          new CodeLens(lens.range, {
            title: 'Clear',
            command: 'extension.jsProfileVisualizer.table.clearCodeLenses',
          }),
        );
      }

      this.lenses[file] = lenses;
    }

    this.changeEmitter.fire();
  }
}
