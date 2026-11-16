import { findFunctions } from "./size-check.functions";
import { tokenize } from "./size-check.tokenize";

export const SIZE_LIMITS = { file: 200, fn: 40 } as const;

export interface SizeViolation {
  path: string;
  line: number;
  message: string;
}

// Lines as `wc -l` plus one for an unterminated last line.
export function countLines(text: string): number {
  if (text === "") return 0;
  const parts = text.split("\n").length;
  return text.endsWith("\n") ? parts - 1 : parts;
}

export function checkSource(path: string, text: string): SizeViolation[] {
  const violations: SizeViolation[] = [];
  const fileLines = countLines(text);
  if (fileLines > SIZE_LIMITS.file) {
    violations.push({
      path,
      line: 1,
      message: `file has ${fileLines} lines (max ${SIZE_LIMITS.file})`,
    });
  }
  for (const fn of findFunctions(tokenize(text))) {
    if (fn.lines > SIZE_LIMITS.fn) {
      violations.push({
        path,
        line: fn.line,
        message: `${fn.name} has ${fn.lines} lines (max ${SIZE_LIMITS.fn})`,
      });
    }
  }
  return violations;
}

export const formatViolation = (violation: SizeViolation): string =>
  `${violation.path}:${violation.line} — ${violation.message}`;
