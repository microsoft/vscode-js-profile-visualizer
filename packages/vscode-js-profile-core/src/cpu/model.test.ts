/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { buildModel } from './model';

describe('model', () => {
  for (let i = 0; i < profiles.length; i++) {
    it(`models #${i}`, () => {
      expect(buildModel(profiles[i])).toMatchSnapshot();
    });
  }

  it('does not error on empty, profile', () => {
    buildModel({
      nodes: [],
      samples: [],
      timeDeltas: [],
      startTime: 1654100488066000,
      endTime: 1654100490779000,
      $vscode: { rootPath: '.', locations: [] },
    });
  });
});

const profiles = [
  {
    nodes: [
      {
        id: 0,
        hitCount: 3,
        callFrame: {
          functionName: 'Native',
          scriptId: '',
          url: '',
          lineNumber: 0,
          columnNumber: 0,
        },
        locationId: 0,
      },
      {
        id: 1,
        hitCount: 1,
        callFrame: {
          functionName: 'func1',
          scriptId: '468',
          url: 'test.js',
          lineNumber: 3,
          columnNumber: 0,
        },
        children: [0],
        locationId: 1,
      },
      {
        id: 2,
        hitCount: 1,
        callFrame: {
          functionName: '<anonymous>',
          scriptId: '468',
          url: 'test.js',
          lineNumber: 8,
          columnNumber: 0,
        },
        children: [1],
        locationId: 2,
      },
    ],
    samples: [0, 0, 0],
    timeDeltas: [200000, 400000, 500000],
    startTime: 1652739599999000,
    endTime: 1652739601099000,
    $vscode: {
      rootPath: '.',
      locations: [
        {
          callFrame: {
            functionName: 'Native',
            scriptId: '',
            url: '',
            lineNumber: 0,
            columnNumber: 0,
          },
          locations: [
            {
              lineNumber: 0,
              columnNumber: 0,
              source: { name: '', path: '', sourceReference: 0 },
            },
          ],
        },
        {
          callFrame: {
            functionName: 'func1',
            scriptId: '468',
            url: 'test.js',
            lineNumber: 3,
            columnNumber: 0,
          },
          locations: [
            {
              lineNumber: 3,
              columnNumber: 0,
              source: {
                name: 'test.js',
                path: 'test.js',
                sourceReference: 0,
              },
            },
          ],
        },
        {
          callFrame: {
            functionName: '<anonymous>',
            scriptId: '468',
            url: 'test.js',
            lineNumber: 8,
            columnNumber: 0,
          },
          locations: [
            {
              lineNumber: 8,
              columnNumber: 0,
              source: {
                name: 'test.js',
                path: 'test.js',
                sourceReference: 0,
              },
            },
          ],
        },
      ],
    },
  },
];
