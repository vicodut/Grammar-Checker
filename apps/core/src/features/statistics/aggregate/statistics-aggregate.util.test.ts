import { describe, expect, test } from "bun:test";
import type { TimedSample } from "../file/statistics-file.schema";
import { median, msPerLetter, msPerWord } from "./statistics-aggregate.util";

const medianOf = (...rows: TimedSample[]) => msPerLetter(rows);

describe("median", () => {
  test("the middle value, or the mean of the two middle values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("msPerLetter", () => {
  test("is null with fewer than five ok samples", () => {
    expect(
      msPerLetter([
        { letters: 10, ms: 50 },
        { letters: 10, ms: 60 },
        { letters: 10, ms: 70 },
        { letters: 10, ms: 80 },
      ]),
    ).toBeNull();
  });

  test("is the median of ms per letter from five ok samples, to one decimal place", () => {
    // ratios 5, 10, 15, 20, 25 -> median 15
    expect(
      medianOf(
        { letters: 10, ms: 50 },
        { letters: 10, ms: 100 },
        { letters: 10, ms: 150 },
        { letters: 10, ms: 200 },
        { letters: 10, ms: 250 },
      ),
    ).toBe(15);
    // ratios 3.33, 10, 10, 10, 10 -> median 10
    expect(
      medianOf(
        { letters: 3, ms: 10 },
        { letters: 1, ms: 10 },
        { letters: 1, ms: 10 },
        { letters: 1, ms: 10 },
        { letters: 1, ms: 10 },
      ),
    ).toBe(10);
    // ratios 1, 1, 1, 1, 3.33 -> median 1
    expect(
      medianOf(
        { letters: 1, ms: 1 },
        { letters: 1, ms: 1 },
        { letters: 1, ms: 1 },
        { letters: 1, ms: 1 },
        { letters: 3, ms: 10 },
      ),
    ).toBe(1);
    // ratios 1, 2, 3.33, 4, 5 -> median 3.33, shown as 3.3
    expect(
      medianOf(
        { letters: 1, ms: 1 },
        { letters: 1, ms: 2 },
        { letters: 3, ms: 10 },
        { letters: 1, ms: 4 },
        { letters: 1, ms: 5 },
      ),
    ).toBe(3.3);
  });
});

describe("msPerWord", () => {
  test("is null with fewer than five ok samples that have a word count", () => {
    expect(
      msPerWord([
        { letters: 10, ms: 50, words: 5 },
        { letters: 10, ms: 60, words: 5 },
        { letters: 10, ms: 70, words: 5 },
        { letters: 10, ms: 80, words: 5 },
      ]),
    ).toBeNull();
  });

  test("is the median of ms per word from five samples with words, to one decimal place", () => {
    // ms per word 5, 10, 15, 20, 25 -> median 15
    expect(
      msPerWord([
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 100, words: 10 },
        { letters: 10, ms: 150, words: 10 },
        { letters: 10, ms: 200, words: 10 },
        { letters: 10, ms: 250, words: 10 },
      ]),
    ).toBe(15);
    // ms per word 1, 2, 3.33, 4, 5 -> median 3.33, shown as 3.3
    expect(
      msPerWord([
        { letters: 1, ms: 1, words: 1 },
        { letters: 1, ms: 2, words: 1 },
        { letters: 3, ms: 10, words: 3 },
        { letters: 1, ms: 4, words: 1 },
        { letters: 1, ms: 5, words: 1 },
      ]),
    ).toBe(3.3);
  });

  test("an old sample with no word count is left out of the median and of the count", () => {
    // four samples with words: not enough, even with the old one beside them
    expect(
      msPerWord([
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 9000 },
      ]),
    ).toBeNull();
    // five with words: the median is theirs alone (all 5), the old 9000 ms sample is ignored
    expect(
      msPerWord([
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 9000 },
      ]),
    ).toBe(5);
  });

  test("a sample with zero words has no ms per word and is left out", () => {
    expect(
      msPerWord([
        { letters: 10, ms: 50, words: 0 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
        { letters: 10, ms: 50, words: 10 },
      ]),
    ).toBe(5);
  });
});
