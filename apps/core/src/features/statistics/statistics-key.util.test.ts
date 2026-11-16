import { describe, expect, test } from "bun:test";
import { statisticsKey } from "./statistics-key.util";

describe("statisticsKey", () => {
  test("the same parts always make the same key", () => {
    expect(statisticsKey("check", "p1", "qwen3:8b")).toBe(statisticsKey("check", "p1", "qwen3:8b"));
  });

  test("parts that would join to the same text under a plain separator still get different keys", () => {
    expect(statisticsKey("a|b", "c")).not.toBe(statisticsKey("a", "b|c"));
    expect(statisticsKey("p", "x,y")).not.toBe(statisticsKey("p,x", "y"));
  });

  test("an empty part is kept, so a missing part can't be mistaken for one that is not there", () => {
    expect(statisticsKey("p1", "")).not.toBe(statisticsKey("p1"));
  });

  test("the order of the parts matters", () => {
    expect(statisticsKey("p1", "m")).not.toBe(statisticsKey("m", "p1"));
  });
});
