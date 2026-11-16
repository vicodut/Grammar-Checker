import type { Token } from "./size-check.tokenize";

// Bracket and token helpers shared by the function scanner and its suite detection.
export const OPENERS = new Set(["(", "[", "{"]);
export const CLOSERS = new Set([")", "]", "}"]);

export const isPunct = (token: Token | undefined, value: string): boolean =>
  token?.kind === "punct" && token.value === value;

// Index of the "(" that matches the ")" at `close`, walking backwards.
export const matchOpenParen = (tokens: Token[], close: number): number | undefined => {
  let depth = 0;
  for (let j = close; j >= 0; j--) {
    if (isPunct(tokens[j], ")")) depth++;
    else if (isPunct(tokens[j], "(") && --depth === 0) return j;
  }
  return undefined;
};

// Index of the ")" that matches the "(" at `open`.
export const matchCloseParen = (tokens: Token[], open: number): number | undefined => {
  let depth = 0;
  for (let j = open; j < tokens.length; j++) {
    if (isPunct(tokens[j], "(")) depth++;
    else if (isPunct(tokens[j], ")") && --depth === 0) return j;
  }
  return undefined;
};

// Index of the "}" that matches the "{" at `open`, or the last token if unclosed.
export const matchCloseBrace = (tokens: Token[], open: number): number => {
  let depth = 0;
  for (let j = open; j < tokens.length; j++) {
    if (isPunct(tokens[j], "{")) depth++;
    else if (isPunct(tokens[j], "}") && --depth === 0) return j;
  }
  return tokens.length - 1;
};
