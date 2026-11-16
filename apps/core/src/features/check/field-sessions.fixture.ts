import type { CoreMessage, Issue } from "@gc/protocol";
import type { AppError } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import type { Result } from "../../shared/result";
import { type Checker, FieldSessions, type Timers } from "./field-sessions.service";

export type CheckResult = Result<{ version?: number; issues: Issue[] }, AppError>;

const fakeTimers = () => {
  let next = 0;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      pending.set(++next, { fn, ms });
      return next;
    },
    clearTimeout: (handle) => pending.delete(handle as number),
  };
  const fire = () => {
    const due = [...pending.values()];
    pending.clear();
    for (const t of due) t.fn();
  };
  return { timers, pending, fire };
};

/** Each check call parks until the test resolves it. */
const fakeChecker = () => {
  const calls: { text: string; version?: number; resolve: (r: CheckResult) => void }[] = [];
  const checker: Checker = {
    check: (input) => new Promise((resolve) => calls.push({ ...input, resolve })),
  };
  return { checker, calls };
};

export const issueIn = (text: string, original: string): Issue => {
  const start = text.indexOf(original);
  return {
    original,
    suggestion: "x",
    reason: "r",
    context: original,
    type: "spelling",
    start,
    end: start + original.length,
  };
};

export const setup = () => {
  const clock = fakeTimers();
  const { checker, calls } = fakeChecker();
  const published: CoreMessage[] = [];
  const logs: string[] = [];
  const sessions = new FieldSessions(
    checker,
    (m) => published.push(m),
    new Logger((l) => logs.push(l)),
    { timers: clock.timers },
  );
  return { clock, calls, published, logs, sessions };
};

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export const spans = (message: CoreMessage | undefined, text: string) =>
  message?.type === "issues" ? message.issues.map((i) => text.slice(i.start, i.end)) : message;
