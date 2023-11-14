/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as Cdp } from 'devtools-protocol';
import { tmpdir } from 'os';
import { resolve } from 'path';
import * as vscode from 'vscode';
import { DebugProtocol as Dap } from 'vscode-debugprotocol';
import { DownloadFileProvider } from './download-file-provider';
import { ISourceLocation } from './location-mapping';
import { properRelative } from './path';

const exists = async (uristr: string) => {
  try {
    const uri = parseUri(uristr);
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
};

/**
 * Gets the best location for display among the given set of candidates
 */
export const openLocation = async ({
  rootPath,
  location,
  viewColumn,
  callFrame,
}: {
  rootPath: string | undefined;
  location?: ISourceLocation;
  viewColumn?: vscode.ViewColumn;
  callFrame?: Cdp.Runtime.CallFrame;
}) => {
  if (location) {
    if (await showPositionInFile(rootPath, location, viewColumn)) {
      return;
    }
  }

  if (callFrame) {
    if (await showPositionInUrl(callFrame, viewColumn)) {
      return;
    }
  }

  vscode.window.showErrorMessage('Could not find the file in your workspace');
};

const showPosition = async (
  doc: vscode.TextDocument,
  lineNumber: number,
  columnNumber: number,
  viewColumn?: vscode.ViewColumn,
) => {
  const pos = new vscode.Position(Math.max(0, lineNumber - 1), Math.max(0, columnNumber - 1));
  await vscode.window.showTextDocument(doc, { viewColumn, selection: new vscode.Range(pos, pos) });
};

const isCommand = (location: ISourceLocation) => !!location.source.path?.match(/^command:/);
const runIfCommand = async (location: ISourceLocation) => {
  if (isCommand(location)) {
    const uri = vscode.Uri.parse(location.source.path || '');
    const baseparams = { sourceLocation: location };
    const params = !uri.query
      ? baseparams
      : uri.query.split('&').reduce((acc, param) => {
          const [name] = param.split('=',1);
          return { ...acc, [name]: decodeURIComponent(param.replace(/[^=]+=/, "")) };
        }, baseparams);
    await vscode.commands.executeCommand(uri.path, params); // delegate finding the position to the command provider
    return true;
  }
  return false;
};

const showPositionInFile = async (
  rootPath: string | undefined,
  location: ISourceLocation,
  viewColumn?: vscode.ViewColumn,
) => {
  if (isCommand(location)) return await runIfCommand(location);
  const diskPaths = getCandidateDiskPaths(rootPath, location.source);
  const foundPaths = await Promise.all(diskPaths.map(exists));
  const existingIndex = foundPaths.findIndex(ok => ok);
  if (existingIndex === -1) {
    return false;
  }

  const doc = await vscode.workspace.openTextDocument(parseUri(diskPaths[existingIndex]));
  await showPosition(doc, location.lineNumber, location.columnNumber, viewColumn);
  return true;
};

const showPositionInUrl = async (
  { url: rawUrl, lineNumber, columnNumber }: Cdp.Runtime.CallFrame,
  viewColumn?: vscode.ViewColumn,
) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }

  const path = resolve(
    vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? tmpdir(),
    url.pathname.slice(1) || 'index.js',
  );

  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(path).with({ scheme: DownloadFileProvider.scheme, query: rawUrl }),
  );
  await showPosition(document, lineNumber + 1, columnNumber + 1, viewColumn);
  return true;
};
/**
 * Checks if an URL is virtual
 * @param url
 * @returns true if part of a virtual filesystem
 */
const isVirtual = (url: string) => {
  const matches = url.match(/^(\w+):/);
  if (!matches) return false;
  if (matches[1].length < 2) return false; // single character scheme is likely to be a windows drive letter
  return true;
};
/**
 *
 * @param url Use Uri.parse when a scheme is provided, fall back to Uri.file otherwise
 * @returns
 */
const parseUri = (url: string) => {
  if (isVirtual(url)) {
    return vscode.Uri.parse(url);
  }
  return vscode.Uri.file(url);
};

/**
 * Gets possible locations for the source on the local disk.
 */
export const getCandidateDiskPaths = (rootPath: string | undefined, source: Dap.Source) => {
  if (!source.path) {
    return [];
  }

  const locations = [source.path];
  if (!rootPath || isVirtual(source.path)) {
    return locations;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    // compute the relative path using the original platform's logic, and
    // then resolve it using the current platform
    locations.push(resolve(folder.uri.fsPath, properRelative(rootPath, source.path)));
  }

  return locations;
};
