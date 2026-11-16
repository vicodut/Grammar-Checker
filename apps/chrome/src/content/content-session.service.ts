// One checking session for this frame: field watcher, underlines/card, badge, rephrase and core port.

import { createSessionParts, type SessionState } from "./content-session.factory";
import { routeBackground, type SessionRoute } from "./content-session.router";
import { FieldWatcher } from "./features/field-watcher";
import type { StopSession } from "./features/site-gate";
import { CorePort } from "./shared/core-port";

/** Starts watching fields; the returned function removes all UI and closes the port. */
export const startSession = (doc: Document): StopSession => {
  const state: SessionState = { status: undefined, rephraseCloud: undefined };
  // The port opens lazily on the first focused field, so idle pages don't wake the worker.
  const port = new CorePort((message) => routeBackground(message, route));
  const parts = createSessionParts(port, state);
  const watcher = new FieldWatcher(doc, {
    changed: (field, fieldId, version, text, cause) => {
      parts.rephrase.track(field, fieldId, version);
      parts.checks.changed(field, fieldId, version, text, cause);
    },
    // A blur keeps the field's rephrase: its tones still arrive and are shown on the next open.
    closed: (field, fieldId) => parts.checks.closed(field, fieldId),
  });
  const route: SessionRoute = { ...parts, state, watcher };

  watcher.start();
  return () => {
    // Stopping the watcher closes the focused field (no text), then the port goes for good.
    watcher.stop();
    port.close();
    parts.checks.dispose();
    parts.view.dispose();
    parts.badge.dispose();
  };
};
