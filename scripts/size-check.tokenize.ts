// Minimal TypeScript/TSX tokenizer for the size check. It drops whitespace and comments and keeps
// strings, templates, regexes and numbers as single literal tokens, so their braces never count.
// It is not a parser: strings end at the line break, which keeps JSX text such as "Don't" from
// swallowing the rest of the file.

export interface Token {
  kind: "ident" | "punct" | "literal";
  value: string;
  line: number;
}

const KEYWORDS_BEFORE_EXPRESSION = new Set([
  "return",
  "typeof",
  "case",
  "do",
  "else",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "instanceof",
  "yield",
  "await",
]);

const IDENT_START = /[\p{ID_Start}_$]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;

interface Cursor {
  text: string;
  at: number;
}

const countNewlines = (text: string, from: number, to: number): number => {
  let count = 0;
  for (let i = from; i < to; i++) if (text[i] === "\n") count++;
  return count;
};

const readQuoted = (text: string, start: number): number => {
  const quote = text[start];
  let j = start + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") j += 2;
    else if (ch === quote) return j + 1;
    else if (ch === "\n") return j;
    else j++;
  }
  return text.length;
};

const readTemplate = (text: string, start: number): number => {
  let j = start + 1;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") j += 2;
    else if (ch === "`") return j + 1;
    else if (ch === "$" && text[j + 1] === "{") j = skipBraces(text, j + 1);
    else j++;
  }
  return text.length;
};

// `open` points at a "{"; returns the index just past its matching "}".
const skipBraces = (text: string, open: number): number => {
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}" && --depth === 0) return j + 1;
  }
  return text.length;
};

const readRegex = (text: string, start: number): number => {
  let j = start + 1;
  let inClass = false;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\\") j += 2;
    else if (ch === "\n") return j;
    else if (ch === "[" || ch === "]") {
      inClass = ch === "[";
      j++;
    } else if (ch === "/" && !inClass) {
      j++;
      while (j < text.length && /[a-z]/i.test(text[j] ?? "")) j++;
      return j;
    } else j++;
  }
  return text.length;
};

// A "/" after "<" is a JSX closing tag (`</span>`), never the start of a regex.
const regexAllowedAfter = (prev: Token | undefined): boolean => {
  if (!prev) return true;
  if (prev.kind === "literal") return false;
  if (prev.value === "<") return false;
  if (prev.kind === "ident") return KEYWORDS_BEFORE_EXPRESSION.has(prev.value);
  return !(prev.value === ")" || prev.value === "]" || prev.value === "}");
};

const readRun = (text: string, start: number, part: RegExp): number => {
  let j = start;
  while (j < text.length && part.test(text[j] ?? "")) j++;
  return j;
};

const readToken = (
  text: string,
  at: number,
  prev: Token | undefined,
): { end: number; token: Omit<Token, "line"> } | undefined => {
  const ch = text[at] ?? "";
  if (ch === '"' || ch === "'") {
    return { end: readQuoted(text, at), token: { kind: "literal", value: ch } };
  }
  if (ch === "`") return { end: readTemplate(text, at), token: { kind: "literal", value: ch } };
  if (ch === "/" && regexAllowedAfter(prev)) {
    return { end: readRegex(text, at), token: { kind: "literal", value: "/re/" } };
  }
  if (/[0-9]/.test(ch)) {
    return { end: readRun(text, at, /[0-9A-Za-z_.]/), token: { kind: "literal", value: ch } };
  }
  if (IDENT_START.test(ch)) {
    const end = readRun(text, at, IDENT_PART);
    return { end, token: { kind: "ident", value: text.slice(at, end) } };
  }
  if (ch === "=" && text[at + 1] === ">") {
    return { end: at + 2, token: { kind: "punct", value: "=>" } };
  }
  return { end: at + 1, token: { kind: "punct", value: ch } };
};

const skipTrivia = (text: string, cursor: Cursor): { line: number } => {
  let line = 0;
  while (cursor.at < text.length) {
    const ch = text[cursor.at];
    const next = text[cursor.at + 1];
    if (ch === "/" && next === "/") {
      while (cursor.at < text.length && text[cursor.at] !== "\n") cursor.at++;
    } else if (ch === "/" && next === "*") {
      const close = text.indexOf("*/", cursor.at + 2);
      const end = close === -1 ? text.length : close + 2;
      line += countNewlines(text, cursor.at, end);
      cursor.at = end;
    } else if (ch === "\n") {
      line++;
      cursor.at++;
    } else if (/\s/.test(ch ?? "")) {
      cursor.at++;
    } else break;
  }
  return { line };
};

// Returns tokens with 1-based line numbers, where a line is where the token starts.
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const cursor: Cursor = { text, at: 0 };
  let line = 1;
  while (cursor.at < text.length) {
    line += skipTrivia(text, cursor).line;
    if (cursor.at >= text.length) break;
    const prev = tokens[tokens.length - 1];
    const read = readToken(text, cursor.at, prev);
    if (!read) break;
    tokens.push({ ...read.token, line });
    line += countNewlines(text, cursor.at, read.end);
    cursor.at = read.end;
  }
  return tokens;
}
