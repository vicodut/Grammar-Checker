import { describe, expect, test } from "bun:test";
import { appError } from "../../shared/errors";
import { err, ok } from "../../shared/result";
import { flush, issueIn, setup } from "./field-sessions.fixture";

describe("FieldSessions lifecycle", () => {
  test("close cancels the timer and drops in-flight results", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "teh cat" });
    sessions.close("f");
    expect(clock.pending.size).toBe(0);
    calls[0]?.resolve(ok({ version: 1, issues: [] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("a reopened field ignores results from before it was closed", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    sessions.close("f");
    sessions.update({ fieldId: "f", version: 1, text: "other" });
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn("teh", "teh")] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("dispose drops everything and ignores later updates", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "a", version: 1, text: "A" });
    clock.fire();
    sessions.update({ fieldId: "b", version: 1, text: "B" });
    sessions.dispose();
    expect(clock.pending.size).toBe(0);
    sessions.update({ fieldId: "c", version: 1, text: "C" });
    expect(clock.pending.size).toBe(0);
    calls[0]?.resolve(ok({ version: 1, issues: [] }));
    await flush();
    expect(published).toEqual([]);
  });

  test("publishes a failed check as an error code for the field", async () => {
    const { clock, calls, published, sessions } = setup();
    sessions.update({ fieldId: "f", version: 1, text: "teh" });
    clock.fire();
    calls[0]?.resolve(err(appError("provider_timeout")));
    await flush();
    expect(published).toEqual([{ type: "error", code: "provider_timeout", fieldId: "f" }]);
  });

  test("never logs user text", async () => {
    const { clock, calls, logs, sessions } = setup();
    const v1 = "secret teh words";
    sessions.update({ fieldId: "f", version: 1, text: v1 });
    clock.fire();
    sessions.update({ fieldId: "f", version: 2, text: "secret tehs words" });
    calls[0]?.resolve(ok({ version: 1, issues: [issueIn(v1, "teh")] }));
    await flush();
    expect(logs.join("\n")).not.toContain("secret");
    expect(logs.join("\n")).not.toContain("teh");
  });
});
