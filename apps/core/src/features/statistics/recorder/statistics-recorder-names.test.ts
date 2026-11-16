import { describe, expect, test } from "bun:test";
import { ok } from "../../../shared/result";
import { StatisticsService } from "../view/statistics.service";
import { StatisticsRecorder } from "./statistics.recorder";
import { answered, memoryStore, quiet } from "./statistics-recorder.fixture";

describe("StatisticsRecorder kept names", () => {
  test("a deleted profile's last name is kept beside its rows, and survives a restart", async () => {
    const { store, saved } = memoryStore();
    const first = new StatisticsRecorder(store, quiet());
    await first.load();
    first.record([answered(480)]);
    first.markRemoved({ profileId: "p1", name: "Local" });
    await first.flush();
    expect(saved()?.removed).toEqual([{ profileId: "p1", name: "Local" }]);

    const restarted = new StatisticsRecorder(store, quiet());
    await restarted.load();
    expect(restarted.removedName("p1")).toBe("Local");
    expect(restarted.entries()).toHaveLength(1);
  });

  test("the name kept is the last one given", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    recorder.markRemoved({ profileId: "p1", name: "Old name" });
    recorder.markRemoved({ profileId: "p1", name: "New name" });
    expect(recorder.removedName("p1")).toBe("New name");
  });

  test("a deleted profile keeps its name even before it has rows, for a call still in flight", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.markRemoved({ profileId: "p9", name: "Unused" });
    await recorder.flush();
    expect(recorder.removedName("p9")).toBe("Unused");
    expect(saved()?.removed).toEqual([{ profileId: "p9", name: "Unused" }]);
  });

  test("a sample recorded after its profile was removed is labelled with the profile's last name", async () => {
    const { store } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.markRemoved({ profileId: "p1", name: "Old name" });
    recorder.record([answered(480)]);
    const service = new StatisticsService(recorder, () => undefined);
    expect(service.view().rows).toMatchObject([
      { profileId: "p1", profileName: "Old name", deleted: true },
    ]);
  });

  test("clear forgets the kept names too", async () => {
    const { store, saved } = memoryStore();
    const recorder = new StatisticsRecorder(store, quiet());
    await recorder.load();
    recorder.record([answered(480)]);
    recorder.markRemoved({ profileId: "p1", name: "Local" });
    expect(await recorder.clear()).toEqual(ok(undefined));
    expect(recorder.removedName("p1")).toBeUndefined();
    expect(saved()).toEqual({ version: 1, removed: [], entries: [] });
  });
});
