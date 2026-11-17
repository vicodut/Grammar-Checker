import { homedir } from "node:os";
import { loadTransportSettings } from "../features/settings";
import { InstallTokenRepository } from "../features/transport";
import type { Logger } from "../shared/logger";
import { EXIT_FAILURE, EXIT_USAGE, type ExitCode } from "./exit-code";
import { browserOpenCommand } from "./open-browser.util";
import { settingsUrl } from "./settings-url.util";

/**
 * `core settings`: opens the settings page of a running core in the default browser (`open` on
 * macOS, `xdg-open` on Linux). If the browser can't be opened, prints the link instead.
 */
export const runSettings = async (logger: Logger): Promise<ExitCode> => {
  const settings = loadTransportSettings(process.env, homedir());
  if (!settings.ok) {
    logger.error({ event: "cli.failed", code: settings.error.code });
    return EXIT_USAGE;
  }
  const token = await new InstallTokenRepository(settings.value.tokenPath).loadOrCreate();
  if (!token.ok) {
    logger.error({ event: "cli.failed", code: token.error.code });
    return EXIT_FAILURE;
  }
  const url = settingsUrl(settings.value.port, token.value);
  if (!(await openInBrowser(url))) process.stdout.write(`${url}\n`);
  return 0;
};

/** True when a browser opened. A missing opener (e.g. no xdg-open) counts as not opened. */
const openInBrowser = async (url: string): Promise<boolean> => {
  const command = browserOpenCommand(process.platform, url);
  if (!command) return false;
  try {
    return (await Bun.spawn(command, { stdout: "ignore", stderr: "ignore" }).exited) === 0;
  } catch {
    return false;
  }
};
