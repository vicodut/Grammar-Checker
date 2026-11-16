import { describe, expect, test } from "bun:test";
import { initialTokenFlow, tokenFlowReducer } from "./token-flow.reducer";

const run = (...events: Parameters<typeof tokenFlowReducer>[1][]) =>
  events.reduce(tokenFlowReducer, initialTokenFlow);

describe("token flow", () => {
  test("starts hidden, not copied, not confirming and not rotated", () => {
    expect(initialTokenFlow).toEqual({
      shown: false,
      copied: false,
      confirming: false,
      rotated: false,
    });
  });

  test("toggling flips whether the token is shown", () => {
    expect(run({ type: "toggleShown" }).shown).toBe(true);
    expect(run({ type: "toggleShown" }, { type: "toggleShown" }).shown).toBe(false);
  });

  test("asking to rotate opens the confirmation; cancelling closes it", () => {
    expect(run({ type: "ask" }).confirming).toBe(true);
    expect(run({ type: "ask" }, { type: "cancel" }).confirming).toBe(false);
  });

  test("a successful copy marks the token copied", () => {
    expect(run({ type: "copied" }).copied).toBe(true);
  });

  test("a refused copy shows the token so it can be selected by hand", () => {
    expect(run({ type: "copyRefused" })).toMatchObject({ shown: true, copied: false });
  });

  test("starting a rotation closes the confirmation and forgets an earlier copy", () => {
    const state = run({ type: "copied" }, { type: "ask" }, { type: "rotateStarted" });
    expect(state).toMatchObject({ confirming: false, copied: false });
  });

  test("a finished rotation that worked is reported and shows the new token", () => {
    expect(run({ type: "rotateStarted" }, { type: "rotateFinished", done: true })).toMatchObject({
      rotated: true,
      shown: true,
    });
  });

  test("a rotation that failed is not reported and leaves the shown state as it was", () => {
    expect(run({ type: "rotateFinished", done: false })).toMatchObject({
      rotated: false,
      shown: false,
    });
  });
});
