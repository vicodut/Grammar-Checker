// The UI and check objects of one session. They refer to each other, so each closure reads a
// sibling only when it runs, not when it is built.
import type { ConnectionStatus } from "../shared/port-messages";
import { REPHRASE_CSS, RephraseController, renderRephraseSection } from "./features/rephrase";
import { StatusBadge } from "./features/status-badge";
import { canSendRephrase } from "./features/text-cap";
import { createIssueView } from "./features/underlines";
import { applyFix } from "./features/write-back";
import { FieldChecks } from "./field-checks.service";
import type { CorePort } from "./shared/core-port";
import { fieldCaret, fieldText } from "./shared/field-text";
import type { WatchedField } from "./shared/issue-view";

/** What the session remembers between messages. */
export interface SessionState {
  status: ConnectionStatus | undefined;
  /** The host rephrase text goes to, while its model is a cloud one. */
  rephraseCloud: string | undefined;
}

export interface SessionParts {
  view: ReturnType<typeof createIssueView>;
  rephrase: RephraseController<WatchedField>;
  badge: StatusBadge;
  checks: FieldChecks;
}

type BadgeSection = NonNullable<ConstructorParameters<typeof StatusBadge>[0]["section"]>;

const copyText = (text: string): Promise<boolean> =>
  navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );

const createRephrase = (
  port: CorePort,
  badge: () => StatusBadge,
): RephraseController<WatchedField> => {
  const rephrase: RephraseController<WatchedField> = new RephraseController<WatchedField>({
    // Over the cap the panel can't open; this guards a request racing the field growing.
    send: (message) => {
      if (canSendRephrase(message)) port.send(message);
      else rephrase.fail(message.fieldId, message.requestId);
    },
    readText: fieldText,
    readCaret: fieldCaret,
    // Same write-back as Accept; the edit's input events then get the new text checked.
    apply: applyFix,
    changed: (field) => badge().refreshPanel(field),
  });
  return rephrase;
};

const rephraseSection = (
  rephrase: () => RephraseController<WatchedField>,
  state: SessionState,
): BadgeSection => ({
  css: REPHRASE_CSS,
  render: (container, field) => {
    const controller = rephrase();
    controller.seen(field);
    renderRephraseSection(
      container,
      controller.state(field),
      {
        rephrase: (tone) => controller.request(field, tone),
        replace: (tone, segment) => void controller.replace(field, tone, segment),
        copy: copyText,
      },
      state.rephraseCloud,
    );
  },
  hasNews: (field) => rephrase().hasNews(field),
});

/** Builds the session's objects. Rephrase lives in the badge panel only; it never feeds the count. */
export const createSessionParts = (port: CorePort, state: SessionState): SessionParts => {
  const view = createIssueView({
    addToDictionary: (term) => {
      checks.dictionaryChanged();
      port.send({ type: "dictionary.add", term });
    },
    visibleChanged: (field, issues) => badge.issues(field, issues),
  });
  const rephrase = createRephrase(port, () => badge);
  const badge = new StatusBadge({
    select: (field, issue) => view.open(field, issue),
    section: rephraseSection(() => rephrase, state),
  });
  // Focus, edits, blur and results; refocusing an unchanged field reuses its last result.
  const checks = new FieldChecks({
    send: (message) => port.send(message),
    view,
    badge,
    status: () => state.status,
  });
  return { view, rephrase, badge, checks };
};
