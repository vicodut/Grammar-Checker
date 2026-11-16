import { afterEach, describe, expect, test } from "bun:test";
import type { FeatureSettingsView, ProfilesView, RuntimeView } from "@gc/protocol";
import type { SettingsPageEvent } from "../../lib/settings-page.model";
import { loadAll, rotateTokenFor, startOllamaFor } from "./settings-page.actions";

const feature: FeatureSettingsView = {
  baseUrl: { value: "http://127.0.0.1:11434/v1", source: "saved" },
  model: { value: "qwen3:8b", source: "saved" },
  reasoningEffort: { value: "none", source: "saved" },
  apiKey: { set: false, source: "unset" },
};
const settingsBody = { check: feature, rephrase: feature };
const profilesBody: ProfilesView = {
  profiles: [],
  features: { check: null, rephrase: null },
  activeProfileId: "p1",
  lockedByEnv: false,
};
const runtimeBody: RuntimeView = {
  ollama: {
    state: "running",
    version: "0.1.0",
    models: [],
    inUse: true,
    startedByApp: false,
    pull: null,
  },
};

type Reply = { status: number; body: unknown };
type Seen = { method: string; path: string; auth: string | null };

// Answers each API path from `replies` and records every request.
const stubApi = (replies: Record<string, Reply>): Seen[] => {
  const seen: Seen[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://core.test");
    const headers = new Headers(init?.headers);
    seen.push({
      method: init?.method ?? "GET",
      path: url.pathname,
      auth: headers.get("authorization"),
    });
    const reply = replies[url.pathname] ?? { status: 404, body: { error: "not_found" } };
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return seen;
};

const okReplies: Record<string, Reply> = {
  "/api/settings": { status: 200, body: settingsBody },
  "/api/profiles": { status: 200, body: profilesBody },
  "/api/runtime": { status: 200, body: runtimeBody },
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("loadAll", () => {
  test("reads the settings, profiles and runtime into one loaded event", async () => {
    stubApi(okReplies);
    expect(await loadAll("tok")).toEqual({
      type: "loaded",
      view: settingsBody,
      profiles: profilesBody,
      runtime: runtimeBody,
    });
  });

  test("a failed settings read is a failed event with the core's code", async () => {
    stubApi({ ...okReplies, "/api/settings": { status: 401, body: { error: "auth_failed" } } });
    expect(await loadAll("tok")).toEqual({ type: "failed", error: "auth_failed" });
  });

  test("a failed runtime read still loads the page, with no runtime", async () => {
    stubApi({ ...okReplies, "/api/runtime": { status: 500, body: { error: "boom" } } });
    const event = await loadAll("tok");
    expect(event).toMatchObject({ type: "loaded", runtime: null });
  });
});

describe("startOllamaFor", () => {
  test("does nothing without a token", async () => {
    const seen = stubApi(okReplies);
    const events: SettingsPageEvent[] = [];
    await startOllamaFor(null, (e) => events.push(e));
    expect(events).toEqual([]);
    expect(seen).toEqual([]);
  });

  test("shows working, starts Ollama with the token, then reloads the page", async () => {
    const seen = stubApi({
      ...okReplies,
      "/api/runtime/ollama/start": { status: 200, body: runtimeBody },
    });
    const events: SettingsPageEvent[] = [];
    await startOllamaFor("tok", (e) => events.push(e));
    expect(events.map((e) => e.type)).toEqual(["working", "loaded"]);
    expect(seen).toContainEqual({
      method: "POST",
      path: "/api/runtime/ollama/start",
      auth: "Bearer tok",
    });
  });

  test("a failed start is an action failure with the core's code, and no reload", async () => {
    stubApi({
      ...okReplies,
      "/api/runtime/ollama/start": { status: 409, body: { error: "ollama_missing" } },
    });
    const events: SettingsPageEvent[] = [];
    await startOllamaFor("tok", (e) => events.push(e));
    expect(events).toEqual([
      { type: "working" },
      { type: "actionFailed", error: "ollama_missing" },
    ]);
  });
});

describe("rotateTokenFor", () => {
  test("does nothing without a token and answers false", async () => {
    const seen = stubApi(okReplies);
    const events: SettingsPageEvent[] = [];
    const rotated = await rotateTokenFor(
      null,
      (e) => events.push(e),
      () => {},
    );
    expect(rotated).toBe(false);
    expect(events).toEqual([]);
    expect(seen).toEqual([]);
  });

  test("hands the new token to the page and reloads with it", async () => {
    const seen = stubApi({
      ...okReplies,
      "/api/token/rotate": {
        status: 200,
        body: { token: "new-token-abcdefghijklmnopqrstuvwxyz012345" },
      },
    });
    const tokens: string[] = [];
    const events: SettingsPageEvent[] = [];
    const rotated = await rotateTokenFor(
      "old-tok",
      (e) => events.push(e),
      (t) => tokens.push(t),
    );
    expect(rotated).toBe(true);
    expect(tokens).toEqual(["new-token-abcdefghijklmnopqrstuvwxyz012345"]);
    expect(events.map((e) => e.type)).toEqual(["working", "loaded"]);
    const reloads = seen.filter((s) => s.path === "/api/settings");
    expect(reloads.at(-1)?.auth).toBe("Bearer new-token-abcdefghijklmnopqrstuvwxyz012345");
  });

  test("a refused rotation keeps the old token and reports the failure", async () => {
    stubApi({ ...okReplies, "/api/token/rotate": { status: 500, body: { error: "disk_full" } } });
    const tokens: string[] = [];
    const events: SettingsPageEvent[] = [];
    const rotated = await rotateTokenFor(
      "old-tok",
      (e) => events.push(e),
      (t) => tokens.push(t),
    );
    expect(rotated).toBe(false);
    expect(tokens).toEqual([]);
    expect(events.at(-1)).toEqual({ type: "actionFailed", error: "disk_full" });
  });
});
