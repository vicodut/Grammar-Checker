// Captures the settings page's Statistics card (light and dark) and its reset confirmation, from
// the sample seeds in docs/screenshots/seed only. Writes PNGs to out/screenshots.
// Everything runs on 127.0.0.1 in a throwaway folder, which is deleted afterwards. See
// .claude/skills/settings-screenshots/SKILL.md for when and how to use it.
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { CdpSession } from "./capture-settings/cdp.session";
import { launchChrome, pageSocketUrl } from "./capture-settings/chrome.util";
import { coreToken, startCore } from "./capture-settings/core.process";
import { copySeeds, freePort, makeSandbox, sandboxEnv } from "./capture-settings/sandbox.util";

const root = join(import.meta.dir, "..");
const SEED_DIR = join(root, "docs/screenshots/seed");
const PAGE_DIR = join(root, "apps/settings-web/dist");
const OUT_DIR = join(root, "out/screenshots");
const CARD = `document.querySelector('[aria-label="Statistics"]')`;
const VIEWPORT = { width: 760, height: 1100, deviceScaleFactor: 1, mobile: false };

const run = async (cmd: string[], cwd: string): Promise<void> => {
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`failed: ${cmd.join(" ")}`);
};

/** Polls the page until `condition` is true, or fails after a while. */
const waitFor = async (session: CdpSession, condition: string, label: string): Promise<void> => {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await session.evaluate<boolean>(`Boolean(${condition})`)) return;
    await Bun.sleep(150);
  }
  throw new Error(`capture.timeout: ${label}`);
};

const setTheme = (session: CdpSession, theme: "light" | "dark") =>
  session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: theme }],
  });

const buttonByText = (text: string): string =>
  `[...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === ${JSON.stringify(text)})`;

const clickButton = async (session: CdpSession, text: string): Promise<void> => {
  const clicked = await session.evaluate<boolean>(
    `(() => { const b = ${buttonByText(text)}; if (!b) return false; b.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`capture.no_button: ${text}`);
};

/** Screenshots the Statistics card, cropped to its box, at two pixels per CSS pixel. */
const captureCard = async (session: CdpSession, file: string): Promise<void> => {
  // The clip is in document coordinates, so the card's box is taken with the scroll offset added.
  const box = await session.evaluate<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(
    `(() => { const el = ${CARD}; if (!el) return null; el.scrollIntoView({ block: "start" });
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`,
  );
  if (!box) throw new Error("capture.no_card");
  const shot = await session.send<{ data: string }>("Page.captureScreenshot", {
    format: "png",
    clip: { ...box, scale: 2 },
    captureBeyondViewport: true,
  });
  await Bun.write(file, Buffer.from(shot.data, "base64"));
};

/** The three captures: the card in light and dark, and the card with its reset confirmation. */
const capture = async (session: CdpSession, port: number, token: string): Promise<void> => {
  await session.send("Page.enable");
  await session.send("Emulation.setDeviceMetricsOverride", VIEWPORT);
  // The token rides in the fragment, which the browser never sends to the server.
  const link = `http://127.0.0.1:${port}/settings#token=${encodeURIComponent(token)}`;
  await session.send("Page.navigate", { url: link });
  await waitFor(session, CARD, "statistics card");
  await setTheme(session, "light");
  await captureCard(session, join(OUT_DIR, "settings-statistics-light.png"));
  await setTheme(session, "dark");
  await captureCard(session, join(OUT_DIR, "settings-statistics-dark.png"));
  await setTheme(session, "light");
  await clickButton(session, "Reset statistics");
  await waitFor(session, buttonByText("Clear all statistics"), "reset confirmation");
  await captureCard(session, join(OUT_DIR, "settings-statistics-reset.png"));
};

const main = async (): Promise<void> => {
  await run([process.execPath, "build.ts"], join(root, "apps/settings-web"));
  await mkdir(OUT_DIR, { recursive: true });
  const dir = await makeSandbox();
  let core: Subprocess | undefined;
  let chrome: Subprocess | undefined;
  let session: CdpSession | undefined;
  try {
    await copySeeds(SEED_DIR, dir);
    const port = freePort();
    const debugPort = freePort();
    const env = sandboxEnv({ dir, port, pageDir: PAGE_DIR });
    core = await startCore(env, port);
    const token = await coreToken(env);
    chrome = launchChrome(join(dir, "chrome"), debugPort);
    session = await CdpSession.connect(await pageSocketUrl(debugPort));
    await capture(session, port, token);
  } finally {
    session?.close();
    chrome?.kill();
    core?.kill();
    await Promise.all([chrome?.exited, core?.exited]);
    await rm(dir, { recursive: true, force: true });
  }
  process.stdout.write(`${OUT_DIR}\n`);
};

await main();
