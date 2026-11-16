import { describe, expect, test } from "bun:test";
import { lettersSent } from "../samples/letters-sent.util";
import { wordsSent } from "../samples/words-sent.util";
import { cellStats, rowLetters, rowWords } from "./statistics-aggregate.util";

describe("cellStats", () => {
  test("words total counts only the ok samples with a word count; an old sample adds letters but no words", () => {
    const cell = cellStats({
      ok: [
        { letters: 10, ms: 50, words: 4 },
        { letters: 20, ms: 100 },
      ],
      failures: {},
    });
    expect(cell.letters).toBe(30);
    expect(cell.words).toBe(4);
    expect(cell.msPerWord).toBeNull();
  });

  test("a sample with zero words does not count toward words; a cell of only those shows null", () => {
    const cell = cellStats({ ok: [{ letters: 10, ms: 50, words: 0 }], failures: {} });
    expect(cell.letters).toBe(10);
    expect(cell.words).toBeNull();
    expect(
      cellStats({
        ok: [
          { letters: 10, ms: 50, words: 0 },
          { letters: 5, ms: 20, words: 3 },
        ],
        failures: {},
      }).words,
    ).toBe(3);
  });

  test("a whitespace-only batch has letters but no words, so it adds no words", () => {
    const sent = ["  \n  "];
    const sample = { letters: lettersSent(sent), ms: 40, words: wordsSent(sent) };
    expect(sample).toEqual({ letters: 5, ms: 40, words: 0 });
    expect(cellStats({ ok: [sample], failures: {} })).toMatchObject({ letters: 5, words: null });
  });

  test("an old-only cell has letters, no word count at all (null, not zero)", () => {
    expect(cellStats({ ok: [{ letters: 10, ms: 50 }], failures: {} }).words).toBeNull();
  });
  test("letters total counts ok samples only; failures are counted by code", () => {
    expect(
      cellStats({
        ok: [
          { letters: 10, ms: 50 },
          { letters: 20, ms: 100 },
        ],
        failures: { timeout: 1, invalid_json: 2 },
      }),
    ).toEqual({
      msPerLetter: null,
      msPerWord: null,
      okCount: 2,
      failureCount: 3,
      letters: 30,
      words: null,
    });
  });

  test("no samples at all is an empty cell", () => {
    expect(cellStats({ ok: [], failures: {} })).toEqual({
      msPerLetter: null,
      msPerWord: null,
      okCount: 0,
      failureCount: 0,
      letters: 0,
      words: null,
    });
  });
});

describe("rowWords", () => {
  test("the words of both features added together, skipping a cell with no word count", () => {
    const check = cellStats({ ok: [{ letters: 10, ms: 50, words: 3 }], failures: {} });
    const rephrase = cellStats({ ok: [{ letters: 7, ms: 30 }], failures: {} });
    expect(rowWords([check, rephrase])).toBe(3);
  });

  test("null when no cell has a word count, so an old-only row shows no words figure", () => {
    const check = cellStats({ ok: [{ letters: 10, ms: 50 }], failures: {} });
    expect(rowWords([check, check])).toBeNull();
  });
});

describe("rowLetters", () => {
  test("the letters of both features' ok samples added together", () => {
    const check = cellStats({
      ok: [
        { letters: 10, ms: 50 },
        { letters: 5, ms: 20 },
      ],
      failures: { timeout: 4 },
    });
    const rephrase = cellStats({ ok: [{ letters: 7, ms: 30 }], failures: { invalid_json: 1 } });
    expect(rowLetters([check, rephrase])).toBe(22);
  });

  test("a feature never run adds nothing, and failures add no letters", () => {
    const check = cellStats({ ok: [], failures: { timeout: 3 } });
    const rephrase = cellStats({ ok: [{ letters: 12, ms: 40 }], failures: {} });
    expect(rowLetters([check, rephrase])).toBe(12);
  });
});
