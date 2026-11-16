// The sample seeds behind the settings screenshots (docs/screenshots/seed) must stay valid for the
// core, and must hold sample data only.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DictionaryFile } from "../src/features/dictionary/dictionary-entry.schema";
import { SettingsFile } from "../src/features/settings/settings-file.schema";
import { StatisticsFile } from "../src/features/statistics/statistics-file.schema";

const seedDir = join(import.meta.dir, "../../../docs/screenshots/seed");
const read = async (name: string): Promise<unknown> =>
  JSON.parse(await Bun.file(join(seedDir, name)).text());

describe("screenshot seeds", () => {
  test("the settings seed is a valid settings file with two sample profiles", async () => {
    const parsed = SettingsFile.parse(await read("settings.json"));
    expect(parsed.profiles.map((p) => p.name)).toEqual(["Sample profile A", "Sample profile B"]);
  });

  test("the statistics seed is valid and keeps a deleted profile's name", async () => {
    const parsed = StatisticsFile.parse(await read("statistics.json"));
    expect(parsed.removed).toEqual([{ profileId: "sample-c", name: "Sample profile C" }]);
    expect(parsed.entries.some((e) => e.model === "sample-model-3")).toBe(true);
  });

  test("the dictionary seed is valid and empty", async () => {
    expect(DictionaryFile.parse(await read("dictionary.json")).entries).toEqual([]);
  });

  test("no seed holds a key, a token, Ollama's port or URLs beyond the sample two", async () => {
    const files = ["settings.json", "statistics.json", "dictionary.json"];
    const text = (
      await Promise.all(files.map(async (name) => Bun.file(join(seedDir, name)).text()))
    ).join("\n");
    expect(text).not.toMatch(/apiKey|api_key|token|password/i);
    expect(text).not.toContain("11434");
    const urls = text.match(/https?:\/\/[^"]+/g) ?? [];
    expect(urls.sort()).toEqual(["http://127.0.0.1:7396/v1", "https://cloud.example.com/v1"]);
  });
});
