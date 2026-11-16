import type {
  FieldClosedMessage,
  Issue,
  IssuesCoreMessage,
  TextChangedMessage,
  TextEditMessage,
} from "@gc/protocol";
import type { ConnectionStatus } from "../shared/port-messages";
import { FieldChecks } from "./field-checks.service";
import type { WatchedField } from "./shared/issue-view";

export const issue: Issue = {
  original: "teh",
  suggestion: "the",
  reason: "Spelling",
  context: "teh cat",
  type: "spelling",
  start: 0,
  end: 3,
};

export const fakeField = (): WatchedField => ({}) as WatchedField;

/** A FieldChecks with recording fakes, driven like the field watcher drives it. */
export const setup = (settleMs = 1000) => {
  const sent: (TextChangedMessage | TextEditMessage | FieldClosedMessage)[] = [];
  const shown: (readonly Issue[])[] = [];
  const badge: string[] = [];
  let status: ConnectionStatus | undefined = "ready";
  const checks = new FieldChecks({
    send: (message) => sent.push(message),
    view: { show: (_f, issues) => shown.push(issues), clear: () => badge.push("clear") },
    badge: {
      checking: () => badge.push("checking"),
      done: () => badge.push("done"),
      tooLong: () => badge.push("too_long"),
      offline: () => badge.push("offline"),
      failed: () => badge.push("failed"),
      hide: () => badge.push("hide"),
    },
    status: () => status,
    settleMs,
  });
  const versions = new Map<string, number>();
  const report = (field: WatchedField, fieldId: string, text: string, cause = "focus") => {
    const version = (versions.get(fieldId) ?? 0) + 1;
    versions.set(fieldId, version);
    checks.changed(field, fieldId, version, text, cause as "focus" | "input" | "resend");
    return version;
  };
  const answer = (fieldId: string, version: number, issues: Issue[]): IssuesCoreMessage => ({
    type: "issues",
    fieldId,
    version,
    issues,
  });
  const setStatus = (next: ConnectionStatus) => {
    status = next;
  };
  return { checks, sent, shown, badge, report, answer, setStatus };
};

export const types = (sent: { type: string }[]) => sent.map((m) => m.type);
