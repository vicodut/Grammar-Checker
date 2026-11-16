import { describe, expect, test } from "bun:test";
import { ContentPortHub } from "./content-port.hub";
import { FakePort, setup } from "./content-port.hub.fixture";

describe("ContentPortHub broadcasts", () => {
  test("passes dictionary additions through and broadcasts core readiness", () => {
    const { hub, toCore, a, b } = setup();
    a.send({ type: "dictionary.add", term: "NestJS" });
    hub.fromCore({ type: "ready" });
    expect(toCore).toEqual([{ type: "dictionary.add", term: "NestJS" }]);
    expect(a.received).toEqual([{ type: "core.ready" }]);
    expect(b.received).toEqual([{ type: "core.ready" }]);
  });

  test("broadcasts a model change to every frame", () => {
    const { hub, a, b } = setup();
    const check = { model: "qwen3:8b", local: true };
    const rephrase = { model: "qwen/qwen3.8-flash", local: false };
    hub.fromCore({ type: "settings.changed", check, rephrase });
    const changed = { type: "core.model_changed", check, rephrase } as const;
    const models = { type: "core.models", check, rephrase } as const;
    expect(a.received).toEqual([models, changed]);
    expect(b.received).toEqual([models, changed]);
  });

  test("tells frames the models at connect without asking them to check again", () => {
    const { hub, a } = setup();
    const check = { model: "m", local: false, provider: "openrouter.ai" };
    const rephrase = { model: "m", local: true };
    hub.fromCore({ type: "ready", check, rephrase });
    expect(a.received).toEqual([{ type: "core.models", check, rephrase }, { type: "core.ready" }]);
    expect(hub.checkModel).toEqual(check);
  });

  test("a ready without models keeps what it knew, and a late frame gets it on attach", () => {
    const { hub } = setup();
    const check = { model: "m", local: false };
    hub.fromCore({ type: "ready", check, rephrase: check });
    hub.fromCore({ type: "ready" });
    const late = new FakePort();
    hub.attach(late);
    expect(late.received).toEqual([
      { type: "core.status", status: "connecting" },
      { type: "core.models", check, rephrase: check },
    ]);
  });

  test("sends the current status on attach and broadcasts changes", () => {
    const hub = new ContentPortHub(() => true);
    const early = new FakePort();
    hub.attach(early);
    hub.setStatus("unreachable");
    const late = new FakePort();
    hub.attach(late);
    expect(early.received).toEqual([
      { type: "core.status", status: "connecting" },
      { type: "core.status", status: "unreachable" },
    ]);
    expect(late.received).toEqual([{ type: "core.status", status: "unreachable" }]);
  });
});
