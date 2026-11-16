import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { sandboxEnv } from "./sandbox.util";

const paths = {
  dir: "/tmp/sandbox-x",
  port: 51234,
  pageDir: "/repo/apps/settings-web/dist",
};

describe("sandboxEnv", () => {
  const env = sandboxEnv(paths);

  test("points every file the core reads at the sandbox copy", () => {
    expect(env.GC_SETTINGS_PATH).toBe(join(paths.dir, "settings.json"));
    expect(env.GC_DICTIONARY_PATH).toBe(join(paths.dir, "dictionary.json"));
    expect(env.GC_TOKEN_PATH).toBe(join(paths.dir, "token"));
  });

  test("runs on a port on 127.0.0.1 and serves the built settings page", () => {
    expect(env.GC_PORT).toBe("51234");
    expect(env.GC_SETTINGS_PAGE_DIR).toBe(paths.pageDir);
  });

  test("sets HOME to the sandbox so default paths never reach the user's files", () => {
    expect(env.HOME).toBe(join(paths.dir, "home"));
  });

  test("passes no model or key from the caller's environment", () => {
    const keys = Object.keys(env);
    expect(keys.filter((k) => /^GC_(BASE_URL|MODEL|API_KEY|REASONING)/.test(k))).toEqual([]);
  });
});
