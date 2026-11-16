// A throwaway folder for one capture: the seed files are copied in, and the core is pointed at
// those copies only. The core's env is built from scratch, so no GC_* variable or real path from
// the caller's shell reaches it.
import { copyFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SEED_FILES = ["settings.json", "statistics.json", "dictionary.json"] as const;

export interface SandboxPaths {
  /** The sandbox folder; every file the core touches lives under it. */
  dir: string;
  port: number;
  /** The built settings page the core serves. */
  pageDir: string;
}

/** The environment the core runs with: sandbox paths and port only, nothing inherited. */
export const sandboxEnv = (paths: SandboxPaths): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: join(paths.dir, "home"),
  GC_PORT: String(paths.port),
  GC_SETTINGS_PATH: join(paths.dir, "settings.json"),
  GC_DICTIONARY_PATH: join(paths.dir, "dictionary.json"),
  GC_TOKEN_PATH: join(paths.dir, "token"),
  GC_SETTINGS_PAGE_DIR: paths.pageDir,
});

/** A new empty folder under the system temp directory. */
export const makeSandbox = (): Promise<string> => mkdtemp(join(tmpdir(), "gc-settings-shots-"));

/** Copies the seed files into the sandbox, so the core writes only to the copies. */
export const copySeeds = async (seedDir: string, dir: string): Promise<void> => {
  await Promise.all(SEED_FILES.map((name) => copyFile(join(seedDir, name), join(dir, name))));
};

/** A port nothing is listening on right now, on 127.0.0.1. */
export const freePort = (): number => {
  const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = server.port;
  server.stop(true);
  return port;
};
