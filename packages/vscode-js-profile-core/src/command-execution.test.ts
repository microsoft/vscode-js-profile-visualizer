/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeCommand = vi.fn();
const showWarningMessage = vi.fn();

vi.mock('vscode', () => ({
  commands: { executeCommand },
  window: { showWarningMessage },
  l10n: {
    t: (message: string, ...args: unknown[]) =>
      message.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)])),
  },
}));

const { executeProfileCommand } = await import('./command-execution');

describe('executeProfileCommand', () => {
  beforeEach(() => {
    executeCommand.mockReset();
    showWarningMessage.mockReset();
  });

  it('runs allowed commands without confirmation', async () => {
    const args = [{ uri: 'file:///foo.heapsnapshot', index: 1, name: 'foo' }];
    await expect(
      executeProfileCommand('jsProfileVisualizer.heapsnapshot.flame.show', args),
    ).resolves.toBe(true);
    expect(showWarningMessage).not.toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith(
      'jsProfileVisualizer.heapsnapshot.flame.show',
      ...args,
    );
  });

  it('does not run other commands unless confirmed', async () => {
    showWarningMessage.mockResolvedValue(undefined);
    await expect(executeProfileCommand('runCommands', [{ commands: ['evil'] }])).resolves.toBe(
      false,
    );
    expect(showWarningMessage).toHaveBeenCalledOnce();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('runs other commands when confirmed', async () => {
    showWarningMessage.mockImplementation(async (_message, _options, run) => run);
    await expect(executeProfileCommand('some.extension.command', ['foo'])).resolves.toBe(true);
    expect(executeCommand).toHaveBeenCalledWith('some.extension.command', 'foo');
  });

  it('shows the command and its arguments in the prompt', async () => {
    showWarningMessage.mockResolvedValue(undefined);
    await executeProfileCommand('workbench.action.terminal.new', ['/bin/zsh']);

    const [message, options] = showWarningMessage.mock.calls[0];
    expect(message).toContain('workbench.action.terminal.new');
    expect(options.modal).toBe(true);
    expect(options.detail).toContain('["/bin/zsh"]');
  });
});
