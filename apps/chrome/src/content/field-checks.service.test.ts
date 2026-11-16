import { describe, expect, test } from "bun:test";
import { MAX_TEXT_LENGTH } from "@gc/protocol";
import { fakeField, issue, setup, types } from "./field-checks.fixture";

describe("FieldChecks", () => {
  test("refocus with unchanged text sends nothing and restores the issues", () => {
    const { checks, sent, shown, badge, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    sent.length = 0;
    shown.length = 0;
    badge.length = 0;
    report(field, "f1", "teh cat");
    expect(sent).toEqual([]);
    expect(shown).toEqual([[issue]]);
    expect(badge.at(-1)).toBe("done");
  });

  test("refocus after an edit made while unfocused checks again", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    const v2 = report(field, "f1", "the cat");
    expect(sent.at(-1)).toEqual({
      type: "text.changed",
      fieldId: "f1",
      version: v2,
      text: "the cat",
    });
  });

  test("an edit or a resend always checks, even with the remembered text", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    report(field, "f1", "teh cat", "input");
    report(field, "f1", "teh cat", "resend");
    // Typing sends an (empty) edit; the resend is the full text.
    expect(types(sent)).toEqual(["text.changed", "text.edit", "text.changed"]);
  });

  test("a field never checked is checked on focus", () => {
    const { sent, report } = setup();
    report(fakeField(), "f1", "Hello.");
    expect(types(sent)).toEqual(["text.changed"]);
  });

  test("a blur with nothing in flight closes at once", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "Fine.");
    checks.issues(answer("f1", v1, []), field);
    checks.closed(field, "f1");
    expect(types(sent)).toEqual(["text.changed", "field.closed"]);
  });

  test("a stale result is neither drawn nor remembered", () => {
    const { checks, shown, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    report(field, "f1", "teh cats", "input");
    checks.issues(answer("f1", v1, [issue]), undefined);
    checks.closed(field, "f1");
    report(field, "f1", "teh cat");
    expect(shown).toEqual([]);
    expect(types(sent).at(-1)).toBe("text.changed");
  });

  test("a dictionary addition forgets remembered results", () => {
    const { checks, sent, report, answer } = setup();
    const field = fakeField();
    const v1 = report(field, "f1", "teh cat");
    checks.issues(answer("f1", v1, [issue]), field);
    checks.closed(field, "f1");
    checks.dictionaryChanged();
    report(field, "f1", "teh cat");
    expect(types(sent).at(-1)).toBe("text.changed");
  });

  test("an over-cap field still shows too long and sends no text", () => {
    const { sent, badge, report } = setup();
    report(fakeField(), "f1", "x".repeat(MAX_TEXT_LENGTH + 1));
    expect(sent).toEqual([{ type: "field.closed", fieldId: "f1" }]);
    expect(badge.at(-1)).toBe("too_long");
  });

  test("offline status is shown instead of the spinner", () => {
    const { badge, report, setStatus } = setup();
    setStatus("unreachable");
    report(fakeField(), "f1", "Hello.");
    expect(badge.at(-1)).toBe("offline");
  });
});
