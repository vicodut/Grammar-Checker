export { StatisticsFileRepository } from "./file/statistics-file.repository";
export { StatisticsFile } from "./file/statistics-file.schema";
export { StatisticsRecorder } from "./recorder/statistics.recorder";
export { type CallSample, samplesForCall } from "./samples/call-sample.util";
export { lettersSent } from "./samples/letters-sent.util";
export { wordsSent } from "./samples/words-sent.util";
export { NO_STATISTICS, type SampleSink } from "./statistics.port";
export { StatisticsService } from "./view/statistics.service";
