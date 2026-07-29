/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    parse: (value: string) => ({ scheme: value.split(':')[0], path: value }),
    file: (value: string) => ({ scheme: 'file', path: value }),
  },
  workspace: { workspaceFolders: undefined },
  commands: { executeCommand: vi.fn() },
}));

const { parseLink } = await import('./open-location');

describe('parseLink', () => {
  it('parses commands', () => {
    expect(
      parseLink(
        'command:jsProfileVisualizer.heapsnapshot.flame.show?' +
          encodeURIComponent('[{"index":42}]'),
      ),
    ).toEqual({
      type: 0,
      command: 'jsProfileVisualizer.heapsnapshot.flame.show',
      args: [{ index: 42 }],
    });
  });

  it('rejects malformed arguments', () => {
    expect(parseLink('command:jsProfileVisualizer.heapsnapshot.flame.show?not-json')).toBe(
      undefined,
    );
  });

  it('still parses files and virtual filesystems', () => {
    expect(parseLink('/tmp/foo.js')).toEqual({
      type: 1,
      uri: { scheme: 'file', path: '/tmp/foo.js' },
      isFile: true,
    });
    expect(parseLink('adt:a4s/foo')).toEqual({
      type: 1,
      uri: { scheme: 'adt', path: 'adt:a4s/foo' },
      isFile: false,
    });
  });
});
