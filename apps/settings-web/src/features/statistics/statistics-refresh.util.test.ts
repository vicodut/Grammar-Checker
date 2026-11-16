import { describe, expect, test } from "bun:test";
import { shouldRefetchStatistics } from "./statistics-refresh.util";

describe("shouldRefetchStatistics", () => {
  test("the window regaining focus refetches the statistics", () => {
    expect(shouldRefetchStatistics({ type: "focus" })).toBe(true);
  });

  test("the page becoming visible again refetches the statistics", () => {
    expect(shouldRefetchStatistics({ type: "visibility", state: "visible" })).toBe(true);
  });

  test("the page being hidden does not refetch", () => {
    expect(shouldRefetchStatistics({ type: "visibility", state: "hidden" })).toBe(false);
  });
});
