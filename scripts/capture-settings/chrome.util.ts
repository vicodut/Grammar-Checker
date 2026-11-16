// Headless Chrome for the capture: its own throwaway profile, and the debugging port on 127.0.0.1.
import type { Subprocess } from "bun";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const launchChrome = (profileDir: string, debugPort: number): Subprocess =>
  Bun.spawn(
    [
      process.env.CAPTURE_CHROME ?? CHROME,
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );

/** Waits for Chrome's debugging endpoint and returns the websocket URL of its first page. */
export const pageSocketUrl = async (debugPort: number, timeoutMs = 15_000): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = (await response.json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = targets.find((target) => target.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await Bun.sleep(200);
  }
  throw new Error("chrome.not_ready");
};
