import { describe, expect, test } from "bun:test";
import { StatisticsRecorder } from "../recorder/statistics.recorder";
import { answered, identity, memoryStore, quiet } from "../recorder/statistics-recorder.fixture";
import { StatisticsService } from "./statistics.service";

describe("StatisticsService row locality", () => {
  test("one profile and model recorded as local and then as cloud shows two rows, each with its own tag", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    const cloud = { ...identity, local: false };
    recorder.record([{ ...answered(500), feature: "rephrase", identity: cloud }]);
    const rows = new StatisticsService(recorder, () => "Home").view().rows;
    expect(rows).toMatchObject([
      { profileId: "p1", local: true, check: { okCount: 1 }, rephrase: { okCount: 0 } },
      { profileId: "p1", local: false, check: { okCount: 0 }, rephrase: { okCount: 1 } },
    ]);
  });

  test("the tag of a row is the tag of every sample in it, whichever feature recorded first", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([
      { ...answered(500), feature: "rephrase", identity: { ...identity, local: false } },
    ]);
    recorder.record([answered(480)]);
    recorder.record([
      { ...answered(490), feature: "rephrase", identity: { ...identity, local: false } },
    ]);
    const rows = new StatisticsService(recorder, () => "Home").view().rows;
    expect(rows).toMatchObject([
      { local: false, check: { okCount: 0 }, rephrase: { okCount: 2 } },
      { local: true, check: { okCount: 1 }, rephrase: { okCount: 0 } },
    ]);
  });
});
