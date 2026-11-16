import { describe, expect, test } from "bun:test";
import type { BackgroundMessage } from "../shared/port-messages";
import { routeBackground, type SessionRoute } from "./content-session.router";

// A route whose collaborators record each call as [name, ...args].
const recordingRoute = (openFields: string[] = []) => {
  const calls: unknown[][] = [];
  const log =
    (name: string, result?: unknown) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return result;
    };
  const route = {
    state: {
      status: undefined as string | undefined,
      rephraseCloud: undefined as string | undefined,
    },
    badge: {
      offline: log("badge.offline"),
      setCloud: log("badge.setCloud"),
    },
    checks: {
      coreReady: log("checks.coreReady"),
      modelChanged: log("checks.modelChanged"),
      resyncNeeded: log("checks.resyncNeeded"),
      failed: log("checks.failed"),
      issues: log("checks.issues"),
    },
    rephrase: {
      receive: log("rephrase.receive"),
      fail: log("rephrase.fail"),
    },
    watcher: {
      resendFocused: log("watcher.resendFocused"),
      openField: (fieldId: string) => (openFields.includes(fieldId) ? { id: fieldId } : undefined),
      currentField: log("watcher.currentField", { id: "current" }),
    },
  };
  return { route: route as unknown as SessionRoute, calls, state: route.state };
};

const model = { model: "m", local: true };
const cloud = { model: "m", local: false, provider: "Acme" };

describe("routeBackground: core state", () => {
  test("records the connection status, and only an offline status reaches the badge", () => {
    const { route, calls, state } = recordingRoute();
    routeBackground({ type: "core.status", status: "ready" }, route);
    expect(state.status).toBe("ready");
    expect(calls).toEqual([]);

    routeBackground({ type: "core.status", status: "auth_failed" }, route);
    expect(state.status).toBe("auth_failed");
    expect(calls).toEqual([["badge.offline", "auth_failed"]]);
  });

  test("a local rephrase model has no cloud host; a cloud one is named by its provider", () => {
    const { route, calls, state } = recordingRoute();
    routeBackground({ type: "core.models", check: model, rephrase: model }, route);
    expect(state.rephraseCloud).toBeUndefined();
    expect(calls).toEqual([["badge.setCloud", undefined]]);

    routeBackground({ type: "core.models", check: model, rephrase: cloud }, route);
    expect(state.rephraseCloud).toBe("Acme");
  });

  test("a cloud model with no provider name is shown as the cloud", () => {
    const { route, calls, state } = recordingRoute();
    const unnamed = { model: "m", local: false };
    routeBackground({ type: "core.models", check: unnamed, rephrase: unnamed }, route);
    expect(state.rephraseCloud).toBe("the cloud");
    expect(calls).toEqual([["badge.setCloud", "the cloud"]]);
  });

  test("core.ready and core.model_changed make the checks run again and resend the focused field", () => {
    const ready = recordingRoute();
    routeBackground({ type: "core.ready" }, ready.route);
    expect(ready.calls).toEqual([["checks.coreReady"], ["watcher.resendFocused"]]);

    const changed = recordingRoute();
    routeBackground({ type: "core.model_changed", check: model, rephrase: model }, changed.route);
    expect(changed.calls).toEqual([["checks.modelChanged"], ["watcher.resendFocused"]]);
  });
});

describe("routeBackground: replies", () => {
  test("rephrase replies go to the rephrase controller, whichever field they concern", () => {
    const { route, calls } = recordingRoute();
    const tone = {
      type: "rephrase.tone",
      fieldId: "f1",
      version: 1,
      requestId: 4,
    } as unknown as BackgroundMessage;
    routeBackground(tone, route);
    expect(calls).toEqual([["rephrase.receive", tone]]);
  });

  test("a rephrase error fails that request; a rephrase error without a field does nothing", () => {
    const { route, calls } = recordingRoute();
    routeBackground(
      { type: "error", code: "x", request: "rephrase", fieldId: "f1", requestId: 9 },
      route,
    );
    routeBackground({ type: "error", code: "x", request: "rephrase" }, route);
    expect(calls).toEqual([["rephrase.fail", "f1", 9]]);
  });

  test("a resync_needed error asks the checks to resync, and resends only an open field", () => {
    const open = recordingRoute(["f1"]);
    routeBackground({ type: "error", code: "resync_needed", fieldId: "f1" }, open.route);
    expect(open.calls).toEqual([
      ["checks.resyncNeeded", "f1", { id: "f1" }],
      ["watcher.resendFocused"],
    ]);

    const closed = recordingRoute();
    routeBackground({ type: "error", code: "resync_needed", fieldId: "f2" }, closed.route);
    expect(closed.calls).toEqual([["checks.resyncNeeded", "f2", undefined]]);
  });

  test("any other field error is a check failure for that field, with its open state", () => {
    const { route, calls } = recordingRoute(["f1"]);
    routeBackground({ type: "error", code: "model_timeout", fieldId: "f1" }, route);
    expect(calls).toEqual([["checks.failed", "f1", "model_timeout", { id: "f1" }]]);
  });

  test("an error with no field and no request is ignored", () => {
    const { route, calls } = recordingRoute();
    routeBackground({ type: "error", code: "core_down" }, route);
    expect(calls).toEqual([]);
  });

  test("issues go to the checks with the field only when that version is the current one", () => {
    const { route, calls } = recordingRoute();
    const issues = {
      type: "issues",
      fieldId: "f1",
      version: 3,
      issues: [],
    } as unknown as BackgroundMessage;
    routeBackground(issues, route);
    expect(calls).toEqual([
      ["watcher.currentField", "f1", 3],
      ["checks.issues", issues, { id: "current" }],
    ]);
  });
});
