import { describe, expect, test } from "bun:test";
import { MAX_REMEMBERED_FIELDS } from "./features/check-memory";
import { fakeField, issue, setup, types } from "./field-checks.fixture";
import type { WatchedField } from "./shared/issue-view";

describe("FieldChecks closing", () => {
  test("a blur during a check waits for its result, remembers it, then closes", () => {
    const { checks, sent, shown, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed"]);
    // The field is closed in the watcher, so the result comes without a field to draw on.
    checks.issues(answer("f1", v1, [issue]), undefined);
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    expect(shown).toEqual([]);
    report(field, "f1", "teh cat");
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
    expect(shown).toEqual([[issue]]);
  });

  test("refocusing before the in-flight result cancels the deferred close", () => {
    const { checks, sent, report } = setup();
    const field = fakeField();
    report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    report(field, "f1", "teh cat");
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed", "text.changed"]);
  });

  test("a deferred close is sent after the settle timeout, an error or a reconnect", async () => {
    const { checks, sent, report } = setup(5);
    const [a, b, c] = [fakeField(), fakeField(), fakeField()];
    report(a, "f1", "one");
    report(b, "f2", "two");
    report(c, "f3", "three");
    for (const [field, id] of [
      [a, "f1"],
      [b, "f2"],
      [c, "f3"],
    ] as const)
      checks.closed(field, id);
    checks.failed("f2", "model_failed", undefined);
    expect(sent.at(-1)).toEqual({ type: "field.closed", fieldId: "f2" });
    checks.coreReady();
    expect(sent.filter((m) => m.type === "field.closed").length).toBe(3);
    report(a, "f1", "one");
    checks.closed(a, "f1");
    await Bun.sleep(20);
    expect(sent.at(-1)).toEqual({ type: "field.closed", fieldId: "f1" });
  });

  test("memory is bounded to the most recent fields", () => {
    const { checks, sent, report, answer } = setup();
    const fields = Array.from({ length: MAX_REMEMBERED_FIELDS + 1 }, fakeField);
    fields.forEach((field, i) => {
      const version = report(field, `f${i}`, "teh cat");
      checks.issues(answer(`f${i}`, version, [issue]), field);
      checks.closed(field, `f${i}`);
    });
    sent.length = 0;
    report(fields[MAX_REMEMBERED_FIELDS] as WatchedField, `f${MAX_REMEMBERED_FIELDS}`, "teh cat");
    expect(sent).toEqual([]);
    report(fields[0] as WatchedField, "f0", "teh cat");
    expect(types(sent)).toEqual(["text.changed"]);
  });
});
