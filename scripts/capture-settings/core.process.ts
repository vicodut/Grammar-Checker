// Runs the core from source against the sandbox environment, and reads its sandbox token.
import { join } from "node:path";
import type { Subprocess } from "bun";

const CLI = join(import.meta.dir, "../../apps/core/src/cli.ts");

/** Starts `core serve` and waits until its settings page answers. */
export const startCore = async (env: Record<string, string>, port: number): Promise<Subprocess> => {
  const proc = Bun.spawn([process.execPath, CLI, "serve"], {
    env,
    stdout: "ignore",
    stderr: "inherit",
  });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/settings`);
      if (response.ok) return proc;
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(200);
  }
  proc.kill();
  throw new Error("core.not_ready");
};

/** The install token of the sandbox core (created in the sandbox on first use). */
export const coreToken = async (env: Record<string, string>): Promise<string> => {
  const proc = Bun.spawn([process.execPath, CLI, "token"], {
    env,
    stdout: "pipe",
    stderr: "inherit",
  });
  const token = (await new Response(proc.stdout).text()).trim();
  if ((await proc.exited) !== 0 || token === "") throw new Error("core.token_failed");
  return token;
};
