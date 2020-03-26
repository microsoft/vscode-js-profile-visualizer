/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { evaluate as evaluateRaw, IEvaluateOptions, compile } from '.';
import { expect } from 'chai';

describe('ql', () => {
  interface IUser {
    index: number;
    name: string;
    age: number;
    friends: IUser[];
  }

  const data: IUser[] = Array.from({ length: 6 }, (_value, i) => ({
    index: i,
    name: `${i}user${String.fromCharCode(97 + i)}`,
    age: i % 3,
    friends: [],
  }));
  data[0].friends = [data[1], data[2]];
  data[1].friends = [data[3]];
  data[2].friends = [data[3]];
  data[3].friends = [];
  data[4].friends = [data[0]];
  data[5].friends = [data[1]];

  const evaluate = (expression: string, expected: IUser[]) => {
    const opts: IEvaluateOptions<IUser> = {
      expression,
      dataSources: {
        users: {
          data,
          properties: { name: 'node.name', age: 'node.age', $index: 'node.index' },
          getChildren: 'return node.friends',
        },
      },
    };
    try {
      expect(evaluateRaw(opts)).to.deep.equal(expected);
    } catch (e) {
      try {
        console.log(compile(opts)?.code);
      } catch {
        // ignored
      }

      throw e;
    }
  };

  it('returns simple', () => {
    expect(evaluate('users()', data));
  });

  describe('simple operators', () => {
    it('has(eq)', () => {
      expect(
        evaluate(
          'users().has(eq(v.age, 2))',
          data.filter(u => u.age === 2),
        ),
      );
    });

    it('has(not(eq))', () => {
      expect(
        evaluate(
          'users().has(not(eq(v.age, 2)))',
          data.filter(u => u.age !== 2),
        ),
      );
    });

    it('has(gt)', () => {
      expect(
        evaluate(
          'users().has(gt(v.age, 1))',
          data.filter(u => u.age > 1),
        ),
      );
    });

    it('has(gte)', () => {
      expect(
        evaluate(
          'users().has(gte(v.age, 1))',
          data.filter(u => u.age >= 1),
        ),
      );
    });

    it('has(lt)', () => {
      expect(
        evaluate(
          'users().has(lt(v.age, 1))',
          data.filter(u => u.age < 1),
        ),
      );
    });

    it('has(lte)', () => {
      expect(
        evaluate(
          'users().has(lte(v.age, 1))',
          data.filter(u => u.age <= 1),
        ),
      );
    });

    it('has(contains)', () => {
      expect(
        evaluate(
          'users().has(contains(v.name, "r1"))',
          data.filter(u => u.name.includes('r1')),
        ),
      );
    });

    it('has(endsWith)', () => {
      expect(
        evaluate(
          'users().has(endsWith(v.name, "r1"))',
          data.filter(u => u.name.endsWith('r1')),
        ),
      );
    });

    it('has(startsWith)', () => {
      expect(
        evaluate(
          'users().has(startsWith(v.name, "1u"))',
          data.filter(u => u.name.startsWith('1u')),
        ),
      );
    });

    it('has(matches())', () => {
      expect(
        evaluate(
          'users().has(matches(v.name, "^1u"))',
          data.filter(u => u.name.startsWith('1u')),
        ),
      );

      expect(
        evaluate(
          'users().has(matches(v.name, "^1U", "i"))',
          data.filter(u => u.name.startsWith('1u')),
        ),
      );

      expect(evaluate('users().has(matches(v.name, "^1U"))', []));
    });

    it('has(or())', () => {
      expect(
        evaluate(
          'users().has(or(eq(v.age, 1), eq(v.age, 2)))',
          data.filter(u => u.age === 2 || u.age === 1),
        ),
      );
    });

    it('has(and())', () => {
      expect(evaluate('users().has(and(eq(v.age, 2), startsWith(v.name, "5u")))', [data[5]]));
    });

    it('has(xor())', () => {
      expect(evaluate('users().has(xor(eq(v.age, 2), startsWith(v.name, "5u")))', [data[2]]));
    });
  });

  describe('hasDeep()', () => {
    it('matches', () => {
      expect(evaluate('users().hasDeep(eq(v.$index, 1))', [data[0], data[1], data[4], data[5]]));
    });

    it('works with no match', () => {
      expect(evaluate('users().hasDeep(eq(v.$index, 42))', []));
    });

    it('works as expression', () => {
      expect(
        evaluate('users().has(and(lt(v.$index, 4), hasDeep(eq(v.$index, 1))))', [data[0], data[1]]),
      );
    });
  });

  describe('orderBy()', () => {
    it('asc()', () => {
      expect(
        evaluate('users().orderBy(asc(v.age))', [
          data[0],
          data[3],
          data[1],
          data[4],
          data[2],
          data[5],
        ]),
      );
    });

    it('desc()', () => {
      expect(
        evaluate('users().orderBy(desc(v.age))', [
          data[2],
          data[5],
          data[1],
          data[4],
          data[0],
          data[3],
        ]),
      );
    });

    it('desc(), asc()', () => {
      expect(
        evaluate('users().orderBy(desc(v.age), asc(v.name))', [
          data[2],
          data[5],
          data[1],
          data[4],
          data[0],
          data[3],
        ]),
      );
    });
    it('desc(), desc()', () => {
      expect(
        evaluate('users().orderBy(desc(v.age), desc(v.name))', [
          data[5],
          data[2],
          data[4],
          data[1],
          data[3],
          data[0],
        ]),
      );
    });
  });
});
