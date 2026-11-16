import { describe, expect, test } from "bun:test";
import { appError } from "../../../shared/errors";
import { err, ok } from "../../../shared/result";
import { StatisticsRecorder } from "./statistics.recorder";
import { answered, memoryStore, quiet } from "./statistics-recorder.fixture";

const unreadable = () => err(appError("statistics_read_failed"));

describe("StatisticsRecorder with a file it cannot read", () => {
  test("the unreadable file is kept aside before the first write, so its rows are not lost", async () => {
    const { store, saved, keptAside } = memoryStore(unreadable());
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    await recorder.flush();
    expect(keptAside()).toBe(true);
    expect(saved()?.entries).toHaveLength(1);
  });

  test("when it cannot be kept aside, nothing is written over it", async () => {
    const { store, saved, keptAside } = memoryStore(unreadable(), { failKeepAside: true });
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    await recorder.flush();
    expect(keptAside()).toBe(false);
    expect(saved()).toBeNull();
  });

  test("a missing file is not kept aside: there is nothing to keep", async () => {
    const { store, keptAside } = memoryStore(ok(null));
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    await recorder.flush();
    expect(keptAside()).toBe(false);
  });
});
