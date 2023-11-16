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

const enum LinkType {
  Command,
  URI,
}

type CommandLink = { type: LinkType.Command; command: string; args: unknown[] };
type UriLink = { type: LinkType.URI; uri: vscode.Uri; isFile: boolean };
type Link = CommandLink | UriLink;

const exists = async (uristr: string) => {
  try {
    const uri = parseLink(uristr);
    if (uri.type === LinkType.Command) return true;
    await vscode.workspace.fs.stat(uri.uri);
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

const runCommand = (link: CommandLink) =>
  vscode.commands.executeCommand(link.command, ...link.args);

const showPositionInFile = async (
  rootPath: string | undefined,
  location: ISourceLocation,
  viewColumn?: vscode.ViewColumn,
): Promise<boolean> => {
  const diskPaths = getCandidateDiskPaths(rootPath, location.source);
  const foundPaths = await Promise.all(diskPaths.map(exists));
  const existingIndex = foundPaths.findIndex(ok => ok);
  if (existingIndex === -1) {
    return false;
  }

  const resolvedLink = parseLink(diskPaths[existingIndex]);
  if (resolvedLink.type === LinkType.Command) {
    await runCommand(resolvedLink); // delegate finding the position to the command provider
    return true;
  }

  const doc = await vscode.workspace.openTextDocument(resolvedLink.uri);
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
 * Parses a link into a link object
 * @param url
 * @returns
 */
const parseLink = (link: string | undefined): Link => {
  const matchCommand = link?.match(/^command:([\w\.]+)(?:\?(.*))?/);
  if (matchCommand) {
    const [command, rawArgs] = matchCommand.slice(1);
    const parsed = rawArgs ? JSON.parse(decodeURIComponent(rawArgs)) : [];
    const args = Array.isArray(parsed) ? parsed : [parsed];
    return { type: LinkType.Command, command, args };
  }
  if (link?.match(/\w\w+:/))
    return { type: LinkType.URI, uri: vscode.Uri.parse(link || ''), isFile: false };
  return { type: LinkType.URI, uri: vscode.Uri.file(link || ''), isFile: true };
};

/**
 * Gets possible locations for the source on the local disk.
 */
export const getCandidateDiskPaths = (rootPath: string | undefined, source: Dap.Source) => {
  if (!source.path) {
    return [];
  }

  const uri = parseLink(source.path);

  const locations = [source.path];
  if (!rootPath || uri.type === LinkType.Command || !uri.isFile) {
    // no resolution for commands and virtual filesystems
    return locations;
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    // compute the relative path using the original platform's logic, and
    // then resolve it using the current platform
    locations.push(resolve(folder.uri.fsPath, properRelative(rootPath, source.path)));
  }

  return locations;
};
