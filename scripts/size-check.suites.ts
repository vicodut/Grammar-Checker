import { CLOSERS, isPunct, OPENERS } from "./size-check.brackets";
import type { Token } from "./size-check.tokenize";

// True when the function starting at `index` is the callback of a `describe` suite. A suite is
// a grouping block; each test inside it is measured on its own.
export const isSuiteCallback = (tokens: Token[], index: number): boolean => {
  let depth = 0;
  for (let j = index - 1; j >= 0; j--) {
    const token = tokens[j];
    if (token?.kind !== "punct") continue;
    if (CLOSERS.has(token.value)) depth++;
    else if (OPENERS.has(token.value)) {
      if (depth > 0) depth--;
      else if (token.value !== "(") return false;
      else return isDescribeCallee(tokens, j);
    }
  }
  return false;
};

// `describe(`, `describe.skip(` or `describe.only(`.
const isDescribeCallee = (tokens: Token[], open: number): boolean => {
  const callee = tokens[open - 1];
  if (callee?.kind === "ident" && callee.value === "describe") return true;
  return (
    callee?.kind === "ident" &&
    (callee.value === "skip" || callee.value === "only") &&
    isPunct(tokens[open - 2], ".") &&
    tokens[open - 3]?.value === "describe"
  );
};
