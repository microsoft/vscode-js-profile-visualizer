/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { expect } from 'chai';
import { IDataSource, IQuery, PropertyType } from '.';
import { compile, lex, LexOutput, ParseError, Token } from './parser';

describe('ql', () => {
  describe('lex', () => {
    const ttable: [string, LexOutput][] = [
      ['hello world', [[Token.Text, 'hello world']]],
      [
        '@hello:world',
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, 'world'],
        ],
      ],
      [
        'test @hello:world',
        [
          [Token.Text, 'test '],
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, 'world'],
        ],
      ],
      [
        '@hello:world test',
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, 'world'],
          [Token.Text, ' test'],
        ],
      ],
      [
        '@hello:"world test"',
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, 'world test'],
        ],
      ],
      [
        '@hello:"esca\\"ped"',
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, 'esca"ped'],
        ],
      ],
      [
        `@hello:'esca\\'ped'`,
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, `esca'ped`],
        ],
      ],
      [
        `@hello:'esca\\\\'ped'`,
        [
          [Token.Column, 'hello'],
          [Token.Operator, ':'],
          [Token.Value, `esca\\`],
          [Token.Text, `ped'`],
        ],
      ],
    ];

    for (const [input, output] of ttable) {
      it(input, () => expect(lex(input).map(l => [l.token, l.text])).to.deep.equal(output));
    }
  });

  describe('compile', () => {
    interface IUser {
      username: string;
      age: number;
    }

    const datasource: IDataSource<IUser> = {
      data: [
        { username: 'u11', age: 10 },
        { username: 'u21', age: 20 },
        { username: 'u12', age: 30 },
        { username: 'u22', age: 40 },
      ],
      getChildren: () => [],
      properties: {
        username: {
          accessor: u => u.username,
          type: PropertyType.String,
        },
        age: {
          accessor: u => u.age,
          type: PropertyType.Number,
        },
      },
      genericMatchStr: u => `user${u.username}`,
    };

    interface ITest {
      input: string;
      out: string[] | string;
      options?: Partial<IQuery<IUser>>;
    }

    const ttable: ITest[] = [
      {
        input: '',
        out: ['u11', 'u21', 'u12', 'u22'],
      },
      {
        input: 'userU1',
        out: [],
        options: { caseSensitive: true },
      },
      {
        input: 'userU1',
        out: ['u11', 'u12'],
        options: { caseSensitive: false },
      },
      {
        input: 'userU.1',
        out: [],
        options: { caseSensitive: true, regex: true },
      },
      {
        input: 'userU.1',
        out: ['u11', 'u21'],
        options: { caseSensitive: false, regex: true },
      },
      {
        input: '@age>15',
        out: ['u21', 'u12', 'u22'],
        options: { caseSensitive: false, regex: true },
      },
      {
        input: '@age>15 @age<35',
        out: ['u21', 'u12'],
        options: { caseSensitive: false, regex: true },
      },
      {
        input: '@age*15',
        out: 'Unknown operator',
      },
    ];

    for (const { input, out, options } of ttable) {
      it(input || '(empty)', () => {
        const getFilter = () =>
          compile(lex(input), {
            datasource,
            caseSensitive: true,
            regex: true,
            input,
            ...options,
          });
        if (typeof out === 'string') {
          expect(getFilter).to.throw(ParseError, out);
        } else {
          const models = datasource.data.filter(getFilter()).map(u => u.username);
          expect(models).to.deep.equal(out);
        }
      });
    }
  });
});
