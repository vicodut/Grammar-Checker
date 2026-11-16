import { describe, expect, test } from "bun:test";
import { ok } from "../../shared/result";
import { flush, issueIn, setup, spans } from "./field-sessions.fixture";
import { DEBOUNCE_MS } from "./field-sessions.service";

describe("FieldSessions", () => {
  test("debounces rapid updates into one check of the latest text", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "I" });
    sessions.update({ fieldId: "f", version: 2, text: "I has" });
    sessions.update({ fieldId: "f", version: 3, text: "I has went" });
    expect(clock.pending.size).toBe(1);
    expect([...clock.pending.values()][0]?.ms).toBe(DEBOUNCE_MS);
    clock.fire();
    expect(calls.map((c) => [c.version, c.text])).toEqual([[3, "I has went"]]);
    calls[0]?.resolve(ok({ version: 3, issues: [issueIn("I has went", "has went")] }));
    await flush();
    expect(published).toEqual([
      { type: "issues", fieldId: "f", version: 3, issues: [issueIn("I has went", "has went")] },
    ]);
  });

  test("ignores versions not newer than the latest", () => {
    const { clock, calls, sessions } = setup();
    sessions.update({ fieldId: "f", version: 5, text: "new" });
    sessions.update({ fieldId: "f", version: 4, text: "old" });
    sessions.update({ fieldId: "f", version: 5, text: "dup" });
    clock.fire();
    expect(calls.map((c) => c.text)).toEqual(["new"]);
  });

  test("keeps fields independent", () => {
    const { clock, calls, sessions } = setup();
    sessions.update({ fieldId: "a", version: 1, text: "A" });
    sessions.update({ fieldId: "b", version: 1, text: "B" });
    clock.fire();
    expect(calls.map((c) => c.text).sort()).toEqual(["A", "B"]);
  });

  test("reconciles a stale result onto the newer text", async () => {
    const { clock, calls, published, logs, sessions } = setup();
    const v1 = "I has went to teh shop.";
    const v2 = "I has went to teh shopping.";
    sessions.update({ fieldId: "f", version: 1, text: v1 });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: v2 });
    const issues = [issueIn(v1, "has went"), issueIn(v1, "teh"), issueIn(v1, "shop.")];
    calls[0]?.resolve(ok({ version: 1, issues }));
    await flush();
    expect(published[0]).toMatchObject({ type: "issues", version: 2 });
    expect(spans(published[0], v2)).toEqual(["has went", "teh"]);
    expect(logs.map((l) => JSON.parse(l))).toContainEqual({
      level: "info",
      event: "reconcile.dropped",
      len: 1,
    });
  });

  test("a newer check waits for the one in flight, then checks the latest text once", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 3, text: "teh cats" });
    clock.fire();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    expect(calls.map((c) => c.version)).toEqual([1, 3]);
    calls[1]?.resolve(ok({ version: 3, issues: [] }));
    await flush();
    expect(published.map((m) => m.type === "issues" && m.version)).toEqual([3, 3]);
  });

  test("publishes an older result reconciled when it arrives first", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    clock.fire();
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    calls[1]?.resolve(ok({ version: 2, issues: [] }));
    await flush();
    expect(published[0]).toMatchObject({ version: 2 });
    expect(spans(published[0], "teh cat")).toEqual(["teh"]);
    // The fresh v2 result replaces the reconciled one: it comes from a newer snapshot.
    expect(published).toHaveLength(2);
    expect(published[1]).toMatchObject({ version: 2, issues: [] });
  });
});
