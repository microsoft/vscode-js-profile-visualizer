/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IQuery, PropertyType } from '.';
import { operators } from './operators';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly index: number,
  ) {
    super(message);
  }
}

export const enum Token {
  Text,
  Column,
  Operator,
  Value,
}

const enum Chars {
  StartColumn = '@',
  SingleQuote = "'",
  DoubleQuote = '"',
  Escape = '\\',
  Space = ' ',
}

const operatorTokens = new Set(
  Object.values(operators)
    .map(v => Object.keys(v))
    .reduce((acc, v) => [...acc, ...v], []),
);

export interface ILexed {
  token: Token;
  text: string;
  start: number;
  length: number;
}

export type LexOutput = [Token, string][];

export const lex = (expr: string) => {
  const tokens: ILexed[] = [];

  let i = 0;
  const eat = (token: Token, test: (char: string, i: number) => boolean): ILexed => {
    let text = '';
    const start = i;
    while (i < expr.length) {
      const char = expr[i] || '';
      if (char === Chars.Escape) {
        text += expr[++i];
        i++;
        continue;
      }

      if (!test(char, i)) {
        break;
      }

      text += char;
      i++;
    }

    return { token, text, start, length: i - start };
  };

  let state = Token.Text;
  if (expr[0] === Chars.StartColumn) {
    state = Token.Column;
    i++;
  }

  while (i < expr.length) {
    const char = expr[i];
    switch (state) {
      case Token.Text:
        const nextCol = expr.indexOf(Chars.Space + Chars.StartColumn, i);
        if (nextCol === -1) {
          tokens.push(eat(Token.Text, () => true));
        } else {
          tokens.push(eat(Token.Text, (_, i) => i <= nextCol));
          i++;
          state = Token.Column; // either starting a column or at end of str
        }
        break;
      case Token.Column:
        tokens.push(eat(Token.Column, c => c >= 'A' && c <= 'z'));
        state = Token.Operator;
        break;
      case Token.Operator:
        tokens.push(eat(Token.Operator, c => operatorTokens.has(c)));
        state = Token.Value;
        break;
      case Token.Value:
        const endWithSpace = char !== Chars.DoubleQuote && char !== Chars.SingleQuote;
        if (!endWithSpace) {
          i++;
        }

        tokens.push(eat(Token.Value, c => (endWithSpace ? c !== Chars.Space : c !== char)));
        state = Token.Text;
        if (!endWithSpace) {
          i++;
        }
        break;
      default:
        throw new Error(`Illegal state ${state}`);
    }
  }

  return tokens;
};

export const compile = <T>(lexed: ILexed[], query: IQuery<T>, ops = operators) => {
  const filterList: ((model: T) => boolean)[] = [];
  const text: string[] = [];
  for (let i = 0; i < lexed.length; i++) {
    const token = lexed[i];
    switch (token?.token) {
      case Token.Column:
        const prop = query.datasource.properties[token.text];
        if (!prop) {
          const available = Object.keys(query.datasource.properties).join(', ');
          throw new ParseError(`Unknown column @${token.text}, have: ${available}`, token.start);
        }

        const op = lexed[++i];
        if (op?.token !== Token.Operator) {
          throw new ParseError(`Missing operator for column @${token.text}`, token.start);
        }

        if (!ops[prop.type][op.text]) {
          throw new ParseError(
            `Unknown operator for @${token.text}, have: ${Object.keys(ops[prop.type]).join(', ')}`,
            op.start,
          );
        }

        const value = lexed[++i];
        if (value?.token !== Token.Value) {
          throw new ParseError(`Missing operand for column @${value?.text}`, token.start);
        }
        const compiled = ops[prop.type]?.[op.text]?.(value.text) as (a: unknown) => boolean;
        filterList.push(m => compiled(prop.accessor(m)));
        break;
      case Token.Text:
        text.push(token.text.trim());
        break;
      default:
        throw new Error(`Illegal token ${token?.token}`);
    }
  }

  const joinedText = text.join(' ').trim();
  if (joinedText) {
    const re =
      `/${query.regex ? joinedText : reEscape(joinedText)}/` + (query.caseSensitive ? '' : 'i');
    const compiled = ops[PropertyType.String]?.['~=']?.(re);
    filterList.push(m => !!compiled && compiled(query.datasource.genericMatchStr(m)));
  }

  return (model: T) => {
    for (const test of filterList) {
      if (!test(model)) {
        return false;
      }
    }

    return true;
  };
};

const reEscape = (str: string) => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // CC0 from MDN
