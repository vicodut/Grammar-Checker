import {
  CLOSERS,
  isPunct,
  matchCloseBrace,
  matchCloseParen,
  matchOpenParen,
  OPENERS,
} from "./size-check.brackets";
import { isSuiteCallback } from "./size-check.suites";
import type { Token } from "./size-check.tokenize";

export interface FunctionSpan {
  name: string;
  // Line where the body opens.
  line: number;
  // Lines from the body's first line to its last, inclusive.
  lines: number;
}

const ANONYMOUS = "anonymous function";

// Words that look like a callee or a name but are control flow or keywords.
const NOT_NAMES = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "with",
  "function",
  "return",
  "typeof",
  "await",
  "yield",
  "new",
  "super",
  "import",
  "export",
  "do",
  "else",
  "case",
  "throw",
  "delete",
  "void",
  "in",
  "of",
  "async",
  "instanceof",
  "default",
  "extends",
]);

const isName = (token: Token | undefined): boolean =>
  token?.kind === "ident" && !NOT_NAMES.has(token.value);

const measureBlock = (tokens: Token[], open: number, name: string): FunctionSpan => {
  const first = tokens[open] as Token;
  const last = tokens[matchCloseBrace(tokens, open)] as Token;
  return { name, line: first.line, lines: last.line - first.line + 1 };
};

// A "{" after a return type opens the body only if it follows a name, ">", ")", "]" or "}".
// Otherwise it is an object type inside the annotation, so the scan skips over it.
const isBodyBrace = (previous: Token | undefined): boolean =>
  previous?.kind === "ident" || [">", ")", "]", "}"].includes(previous?.value ?? "");

// Finds the body "{" after a `: ReturnType` annotation, starting at `start`.
const bodyAfterReturnType = (tokens: Token[], start: number): number | undefined => {
  let depth = 0;
  for (let j = start; j < tokens.length; j++) {
    const token = tokens[j];
    if (token?.kind !== "punct") continue;
    const value = token.value;
    if (value === "(" || value === "[") depth++;
    else if (value === "{") {
      if (depth === 0 && isBodyBrace(tokens[j - 1])) return j;
      depth++;
    } else if (value === ")" || value === "]" || value === "}") {
      if (depth === 0) return undefined;
      depth--;
    } else if ((value === ";" || value === "=" || value === "=>") && depth === 0) {
      return undefined;
    }
  }
  return undefined;
};

// Name for a function started at `start`: the key or variable it is assigned to, if any.
const nameBefore = (tokens: Token[], start: number): string => {
  const assign = tokens[start - 1];
  const target = tokens[start - 2];
  if ((isPunct(assign, "=") || isPunct(assign, ":")) && target && isName(target))
    return target.value;
  return ANONYMOUS;
};

const arrowName = (tokens: Token[], arrow: number): string => {
  let start = arrow - 1;
  if (isPunct(tokens[start], ")")) {
    const open = matchOpenParen(tokens, start);
    if (open === undefined) return ANONYMOUS;
    start = open;
  }
  if (tokens[start - 1]?.value === "async") start--;
  return nameBefore(tokens, start);
};

// Span of an expression-bodied arrow: from its first token to the last before a closer,
// a "," or ";" at the top level.
const expressionSpan = (tokens: Token[], first: number, name: string): FunctionSpan | undefined => {
  const start = tokens[first];
  if (!start) return undefined;
  let depth = 0;
  let last = first;
  for (let j = first; j < tokens.length; j++) {
    const token = tokens[j] as Token;
    if (token.kind === "punct") {
      if (OPENERS.has(token.value)) depth++;
      else if (CLOSERS.has(token.value)) {
        if (depth === 0) break;
        depth--;
      } else if (depth === 0 && [",", ";", ":"].includes(token.value)) break;
    }
    last = j;
  }
  const end = tokens[last] as Token;
  return { name, line: start.line, lines: end.line - start.line + 1 };
};

const arrowSpan = (tokens: Token[], arrow: number): FunctionSpan | undefined => {
  const name = arrowName(tokens, arrow);
  if (isPunct(tokens[arrow + 1], "{")) return measureBlock(tokens, arrow + 1, name);
  return expressionSpan(tokens, arrow + 1, name);
};

// Declarations, methods, constructors, accessors and function expressions: a "(" whose
// parameter list is followed by a body or a return type and a body.
const callableSpan = (tokens: Token[], open: number): FunctionSpan | undefined => {
  const previous = tokens[open - 1];
  let name: string;
  if (previous && isName(previous)) name = previous.value;
  else if (previous?.value === "function") name = nameBefore(tokens, open - 1);
  else return undefined;

  const close = matchCloseParen(tokens, open);
  if (close === undefined) return undefined;
  const after = tokens[close + 1];
  let body: number | undefined;
  if (isPunct(after, "{")) body = close + 1;
  else if (isPunct(after, ":")) body = bodyAfterReturnType(tokens, close + 2);
  return body === undefined ? undefined : measureBlock(tokens, body, name);
};

// Every function-like body in the token stream, nested ones included.
export function findFunctions(tokens: Token[]): FunctionSpan[] {
  const spans: FunctionSpan[] = [];
  tokens.forEach((token, index) => {
    if (isPunct(token, "=>")) {
      if (!isSuiteCallback(tokens, index)) pushSpan(spans, arrowSpan(tokens, index));
    } else if (isPunct(token, "(")) {
      if (!isSuiteCallback(tokens, index)) pushSpan(spans, callableSpan(tokens, index));
    }
  });
  return spans;
}

const pushSpan = (spans: FunctionSpan[], span: FunctionSpan | undefined): void => {
  if (span) spans.push(span);
};
