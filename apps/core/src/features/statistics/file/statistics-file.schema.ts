import { Feature } from "@gc/protocol";
import { z } from "zod";
import type { ProfileName } from "../../../shared/profile-name.type";

/** A failure's code as stored: lower-case letters and underscores only, so no text can hide in it. */
const Code = z.string().regex(/^[a-z_]{1,40}$/);

/**
 * One ok sample as it sits on disk: [letters, ms] or [letters, ms, words]. Samples saved before
 * word counts have no third item. Those still count toward letters, and are left out of the words
 * total and the per-word median. A missing word count is never stored as zero.
 */
const SampleRecord = z.tuple([
  z.number().int().positive(),
  z.number().nonnegative(),
  z.number().int().nonnegative().optional(),
]);

/** One ok sample in memory: the letters it checked (at least one), the ms it took, and its words when known. */
export type TimedSample = {
  readonly letters: number;
  readonly ms: number;
  readonly words?: number | undefined;
};

/** One row cell's numbers as stored: one entry per feature, profile and model. */
const EntryRecord = z.strictObject({
  feature: Feature,
  profileId: z.string().min(1).max(100),
  model: z.string().min(1),
  local: z.boolean(),
  ok: z.array(SampleRecord),
  failures: z.record(Code, z.number().int().nonnegative()),
});

/** A deleted profile's last name, kept beside its rows so they can still be labelled. */
const RemovedName = z.strictObject({
  profileId: z.string().min(1).max(100),
  name: z.string().min(1).max(60),
});

const FileRecord = z.strictObject({
  version: z.literal(1),
  removed: z.array(RemovedName).default([]),
  entries: z.array(EntryRecord),
});

export type StatisticsEntry = Omit<z.infer<typeof EntryRecord>, "ok"> & {
  ok: TimedSample[];
};

/** `statistics.json` in memory: the samples with named fields, plus each deleted profile's last name. */
export type StatisticsFile = {
  readonly version: 1;
  readonly removed: ProfileName[];
  readonly entries: StatisticsEntry[];
};

const decodeSample = ([letters, ms, words]: z.infer<typeof SampleRecord>): TimedSample =>
  words === undefined ? { letters, ms } : { letters, ms, words };

const encodeSample = (sample: TimedSample): z.infer<typeof SampleRecord> =>
  sample.words === undefined
    ? [sample.letters, sample.ms]
    : [sample.letters, sample.ms, sample.words];

/** Reads `statistics.json`: the stored tuples come back as named samples. */
export const StatisticsFile = FileRecord.transform(
  (file): StatisticsFile => ({
    version: file.version,
    removed: file.removed,
    entries: file.entries.map((entry) => ({ ...entry, ok: entry.ok.map(decodeSample) })),
  }),
);

/** The file as it is written: samples back in their tuple form. */
export const encodeStatisticsFile = (file: StatisticsFile): z.infer<typeof FileRecord> => ({
  version: file.version,
  removed: file.removed,
  entries: file.entries.map((entry) => ({ ...entry, ok: entry.ok.map(encodeSample) })),
});
