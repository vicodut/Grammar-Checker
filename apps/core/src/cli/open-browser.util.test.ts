import { describe, expect, test } from "bun:test";
import { browserOpenCommand } from "./open-browser.util";

describe("browserOpenCommand", () => {
  test("uses open on macOS", () => {
    expect(browserOpenCommand("darwin", "http://127.0.0.1:7341/settings")).toEqual([
      "open",
      "http://127.0.0.1:7341/settings",
    ]);
  });

  test("uses xdg-open on Linux", () => {
    expect(browserOpenCommand("linux", "http://127.0.0.1:7341/settings")).toEqual([
      "xdg-open",
      "http://127.0.0.1:7341/settings",
    ]);
  });

  test("has no opener on other systems, so the link is printed", () => {
    expect(browserOpenCommand("win32", "http://127.0.0.1:7341/settings")).toBeNull();
  });
});
