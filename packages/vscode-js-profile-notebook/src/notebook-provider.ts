/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { ICpuProfileRaw } from 'vscode-js-profile-core/out/cpu/types';
import { Constants } from './types';
import { IGraphNode, buildModel, IProfileModel } from 'vscode-js-profile-core/out/cpu/model';
import { evaluate } from 'vscode-js-profile-core/out/ql/index';
import { createBottomUpGraph, BottomUpNode } from 'vscode-js-profile-core/out/cpu/bottomUpGraph';

type RawCpuCell = { markdown: string } | { query: string };

export interface ICpuProfileWithNotebook extends ICpuProfileRaw {
  $cells?: RawCpuCell[];
}

const addCell = (edit: vscode.NotebookEditorCellEdit, cell: RawCpuCell) =>
  'markdown' in cell
    ? edit.insert(0, cell.markdown, Constants.MarkdownLanguage, vscode.CellKind.Markdown, [], {
        editable: true,
        runnable: true,
      })
    : edit.insert(0, cell.query, Constants.QueryLanguage, vscode.CellKind.Code, [], {
        editable: true,
        runnable: true,
      });

const errorOutput = (message: string): vscode.CellOutput => ({
  outputKind: vscode.CellOutputKind.Rich,
  data: { 'text/plain': message },
});

export class NotebookProvider implements vscode.NotebookProvider {
  private readonly models = new WeakMap<
    vscode.NotebookDocument,
    { raw: ICpuProfileWithNotebook; model: IProfileModel; bottomUp: BottomUpNode }
  >();

  /**
   * @inheritdoc
   */
  public async resolveNotebook(editor: vscode.NotebookEditor): Promise<void> {
    const content = await vscode.workspace.fs.readFile(editor.document.uri);
    const raw: ICpuProfileWithNotebook = JSON.parse(new TextDecoder().decode(content));
    const model = buildModel(raw);
    this.models.set(editor.document, { raw, model, bottomUp: createBottomUpGraph(model) });
    editor.document.languages = ['cpuprofile'];

    await editor.edit(edit => {
      if (!raw.$cells?.length) {
        addCell(edit, { query: 'query()' });
        return;
      }

      for (const cell of raw.$cells) {
        addCell(edit, cell);
      }
    });
  }

  /**
   * @inheritdoc
   */
  public async executeCell(
    document: vscode.NotebookDocument,
    cell: vscode.NotebookCell | undefined,
  ): Promise<void> {
    if (cell?.language !== 'cpuprofile') {
      return;
    }

    const model = this.models.get(document);
    if (!model) {
      cell.outputs = [errorOutput('Cannot find model for document, please reload')];
      return;
    }

    let result: IGraphNode[] = [];
    try {
      result = evaluate({
        expression: cell.source,
        dataSources: {
          query: {
            data: Object.values(model.bottomUp.children),
            properties: {
              function: 'node.callFrame.functionName',
              url: 'node.callFrame.url',
              line: '(node.src ? node.src.lineNumber : node.callFrame.lineNumber)',
              path: '(node.src ? node.src.relativePath : node.callFrame.url)',
              selfTime: 'node.selfTime',
              totalTime: 'node.aggregateTime',
              id: 'node.id',
            },
            getChildren: 'return Object.values(node.children)',
          },
        },
      });
    } catch (e) {
      cell.outputs = [errorOutput(e.stack || e.message)];
      return;
    }

    cell.outputs = [
      {
        outputKind: vscode.CellOutputKind.Rich,
        data: { [Constants.TableMimeType]: result },
      },
    ];
  }

  /**
   * @inheritdoc
   */
  public async save(document: vscode.NotebookDocument): Promise<boolean> {
    const model = this.models.get(document);
    if (!model) {
      throw new Error('Cannot find model for document');
    }

    const updated: ICpuProfileWithNotebook = {
      ...model.raw,
      $cells: document.cells.map(cell =>
        cell.language === Constants.MarkdownLanguage
          ? { markdown: cell.source }
          : { query: cell.source },
      ),
    };

    await vscode.workspace.fs.writeFile(document.uri, Buffer.from(JSON.stringify(updated)));
    return true;
  }
}
