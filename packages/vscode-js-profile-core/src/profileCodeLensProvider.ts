/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
  CodeLens,
  CodeLensProvider,
  commands,
  Disposable,
  EventEmitter,
  ProviderResult,
  TextDocument,
} from 'vscode';
import { INode } from './common/model';
import { DownloadFileProvider } from './download-file-provider';
import { lowerCaseInsensitivePath } from './path';
import { ProfileAnnotations } from './profileAnnotations';

/**
 * Shows code lens information for the currently active profile.
 */
export class ProfileCodeLensProvider implements CodeLensProvider {
  private readonly changeEmitter = new EventEmitter<void>();
  private lenses?: ProfileAnnotations<{}, INode>;

  /**
   * @inheritdoc
   */
  public onDidChangeCodeLenses = this.changeEmitter.event;

  /**
   * Updates the set of lenses currently being displayed.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerLenses(lenses: ProfileAnnotations<{}, INode>): Disposable {
    commands.executeCommand('setContext', 'jsProfileVisualizer.hasCodeLenses', true);
    this.lenses = lenses;

    return {
      dispose: () => {
        if (this.lenses === lenses) {
          this.clear();
        }
      },
    };
  }

  /**
   * Clears the current set of profiling lenses.
   */
  public clear() {
    if (this.lenses) {
      this.lenses = undefined;
      commands.executeCommand('setContext', 'jsProfileVisualizer.hasCodeLenses', false);
      this.changeEmitter.fire();
    }
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
