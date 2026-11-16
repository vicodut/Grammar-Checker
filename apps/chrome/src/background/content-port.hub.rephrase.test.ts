import { describe, expect, test } from "bun:test";
import { ContentPortHub } from "./content-port.hub";
import { FakePort, setup } from "./content-port.hub.fixture";

const rephraseRequest = (requestId: number) => ({
  type: "rephrase.request" as const,
  fieldId: "f1",
  version: 2,
  requestId,
  text: "Hi.",
  caret: 0,
});

const tone = (requestId: number) => ({
  type: "rephrase.tone" as const,
  fieldId: "p1/f1",
  version: 2,
  requestId,
  passage: { start: 0, end: 3 },
  sentences: [{ text: "Hi.", start: 0, end: 3 }],
  language: "en" as const,
  tone: "casual" as const,
  segments: [{ from: 0, to: 0, keep: true as const }],
});

const done = (requestId: number) => ({
  type: "rephrase.done" as const,
  fieldId: "p1/f1",
  version: 2,
  requestId,
  count: 1,
});

describe("ContentPortHub rephrase", () => {
  test("routes every tone of a rephrase to its port, even after the field closed", () => {
    const { hub, toCore, a } = setup();
    a.send(rephraseRequest(1));
    expect(toCore).toEqual([{ ...rephraseRequest(1), fieldId: "p1/f1" }]);
    hub.fromCore(tone(1));
    a.send({ type: "field.closed", fieldId: "f1" });
    hub.fromCore({ ...tone(1), tone: "concise" });
    hub.fromCore(done(1));
    expect(a.received).toEqual([
      { ...tone(1), fieldId: "f1" },
      { ...tone(1), tone: "concise", fieldId: "f1" },
      { ...done(1), fieldId: "f1" },
    ]);
    hub.fromCore(tone(1));
    expect(a.received).toHaveLength(3);
  });

  test("drops replies to a superseded rephrase, whose error doesn't end the newer one", () => {
    const { hub, a } = setup();
    a.send(rephraseRequest(1));
    a.send(rephraseRequest(2));
    const cancelled = {
      type: "error" as const,
      code: "rephrase_cancelled",
      fieldId: "p1/f1",
      request: "rephrase" as const,
      requestId: 1,
    };
    hub.fromCore(cancelled);
    hub.fromCore(tone(2));
    expect(a.received).toEqual([{ ...tone(2), fieldId: "f1" }]);
  });

  test("a frame going away cancels its running rephrase", () => {
    const { toCore, a } = setup();
    a.send(rephraseRequest(1));
    toCore.length = 0;
    a.disconnect();
    expect(toCore).toContainEqual({ type: "rephrase.cancel", fieldId: "p1/f1" });
  });

  test("a rephrase the core can't take fails at once", () => {
    const hub = new ContentPortHub(() => false);
    const port = new FakePort();
    hub.attach(port);
    port.received.length = 0;
    port.send(rephraseRequest(4));
    expect(port.received).toEqual([
      { type: "error", code: "core_unavailable", fieldId: "f1", request: "rephrase", requestId: 4 },
    ]);
  });
});
