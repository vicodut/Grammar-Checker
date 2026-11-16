import { describe, expect, test } from "bun:test";
import { encodeStatisticsFile, StatisticsFile } from "./statistics-file.schema";

// A file with one entry whose ok samples are given as they sit on disk: [letters, ms] or
// [letters, ms, words].
const fileWith = (ok: unknown[]) => ({
  version: 1,
  removed: [],
  entries: [{ feature: "check", profileId: "p1", model: "m", local: true, ok, failures: {} }],
});

describe("statistics file samples", () => {
  test("an old sample (no word count) and a new one both load with named fields", () => {
    const parsed = StatisticsFile.parse(
      fileWith([
        [12, 340],
        [20, 500, 4],
      ]),
    );
    expect(parsed.entries[0]?.ok).toEqual([
      { letters: 12, ms: 340 },
      { letters: 20, ms: 500, words: 4 },
    ]);
  });

  test("encoding writes the tuples back as they are on disk", () => {
    const parsed = StatisticsFile.parse(
      fileWith([
        [12, 340],
        [20, 500, 4],
      ]),
    );
    const encoded = encodeStatisticsFile(parsed);
    expect(encoded.entries[0]?.ok).toEqual([
      [12, 340],
      [20, 500, 4],
    ]);
  });

  test("a sample with no letters is not a valid sample", () => {
    expect(StatisticsFile.safeParse(fileWith([[0, 340]])).success).toBe(false);
  });
});
