// Routes what the background sends to this frame's session objects.
import type { FeatureModel } from "@gc/protocol";
import {
  type BackgroundMessage,
  type CoreModelChangedMessage,
  type CoreReadyMessage,
  isOffline,
} from "../shared/port-messages";
import type { SessionParts, SessionState } from "./content-session.factory";
import type { FieldWatcher } from "./features/field-watcher";
import type { FieldChecks } from "./field-checks.service";

export interface SessionRoute extends SessionParts {
  state: SessionState;
  watcher: FieldWatcher;
}

// Every message except the core state and issue results, which routeBackground handles itself.
type FailureMessage = Exclude<
  BackgroundMessage,
  { type: "core.status" | "core.models" | "core.ready" | "core.model_changed" | "issues" }
>;

/** Where a feature's text goes: its host (or "the cloud" if unnamed) when the model is not local. */
const cloudHost = (model: FeatureModel): string | undefined =>
  model.local ? undefined : (model.provider ?? "the cloud");

const routeLifecycle = (
  message: CoreReadyMessage | CoreModelChangedMessage,
  checks: FieldChecks,
  watcher: FieldWatcher,
): void => {
  if (message.type === "core.ready") checks.coreReady();
  else checks.modelChanged();
  watcher.resendFocused();
};

const routeFailure = (message: FailureMessage, route: SessionRoute): void => {
  // Rephrase replies may concern a closed (blurred) field; the controller knows its fields.
  if (message.type === "rephrase.tone" || message.type === "rephrase.done") {
    route.rephrase.receive(message);
    return;
  }
  if (message.request === "rephrase") {
    if (message.fieldId !== undefined) route.rephrase.fail(message.fieldId, message.requestId);
    return;
  }
  if (message.fieldId === undefined) return;
  if (message.code === "resync_needed") {
    // The core lost the edit's base: resend the full text as a new version, not a failure.
    const field = route.watcher.openField(message.fieldId);
    route.checks.resyncNeeded(message.fieldId, field);
    if (field) route.watcher.resendFocused();
    return;
  }
  route.checks.failed(message.fieldId, message.code, route.watcher.openField(message.fieldId));
};

export const routeBackground = (message: BackgroundMessage, route: SessionRoute): void => {
  if (message.type === "core.status") {
    route.state.status = message.status;
    if (isOffline(message.status)) route.badge.offline(message.status);
    return;
  }
  if (message.type === "core.models") {
    route.state.rephraseCloud = cloudHost(message.rephrase);
    route.badge.setCloud(cloudHost(message.check));
    return;
  }
  if (message.type === "core.ready" || message.type === "core.model_changed") {
    routeLifecycle(message, route.checks, route.watcher);
    return;
  }
  if (message.type === "issues") {
    // Only the current version is drawn; a blurred field's result is only remembered.
    route.checks.issues(message, route.watcher.currentField(message.fieldId, message.version));
    return;
  }
  routeFailure(message, route);
};
