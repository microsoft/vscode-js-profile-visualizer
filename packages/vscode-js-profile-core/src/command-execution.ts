/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Commands which may be executed on behalf of profile content -- either via a
 * `command:` URI in a source location, or via a message from one of our
 * webviews -- without asking the user first.
 *
 * Profiles are untrusted input: they open in our custom editors without any
 * prompt, even in Restricted Mode. Only commands contributed by the visualizer
 * extensions, which are safe to invoke with untrusted arguments, belong in
 * this list. Anything else requires explicit confirmation from the user.
 */
const allowedCommands: ReadonlySet<string> = new Set([
  'jsProfileVisualizer.heapsnapshot.flame.show',
]);

const formatArgs = (args: unknown[]) => {
  try {
    return JSON.stringify(args) ?? String(args);
  } catch {
    return String(args);
  }
};

const confirmCommand = async (command: string, args: unknown[]) => {
  const run = vscode.l10n.t('Run Command');
  const result = await vscode.window.showWarningMessage(
    vscode.l10n.t('Do you want to run the command "{0}"?', command),
    {
      modal: true,
      detail: vscode.l10n.t(
        'This command was requested by the profile you have open, which may not be trustworthy. Only run it if you know what it does.\n\nArguments: {0}',
        formatArgs(args),
      ),
    },
    run,
  );

  return result === run;
};

/**
 * Runs a command requested by profile content. Commands which are not in the
 * {@link allowedCommands} list require the user to confirm them first.
 *
 * Resolves to true if the command was executed.
 */
export const executeProfileCommand = async (command: string, args: unknown[]) => {
  if (!allowedCommands.has(command) && !(await confirmCommand(command, args))) {
    return false;
  }

  await vscode.commands.executeCommand(command, ...args);
  return true;
};
