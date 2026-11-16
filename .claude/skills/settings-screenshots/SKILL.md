---
name: settings-screenshots
description: Capture screenshots of the settings page's Statistics card (light, dark, reset confirmation) for a UI pull request, from sample data only. Use when a PR changes the settings page, its statistics, or anything else the user sees there.
---

# Settings screenshots

The script `scripts/capture-settings-screenshots.ts` does the whole capture. Do not write a new capture.

## Steps

1. From the repo root, run `bun scripts/capture-settings-screenshots.ts`.
   It builds the settings page, copies the sample seeds in `docs/screenshots/seed/` into a temp sandbox, starts the core on a free 127.0.0.1 port with its settings, token, dictionary and home paths inside the sandbox, drives headless Chrome, and stops both processes. Done when it exits 0 and prints `out/screenshots`.
2. Check that `out/screenshots/` holds `settings-statistics-light.png`, `settings-statistics-dark.png` and `settings-statistics-reset.png`. Open each one. Done when each shows the card with the sample names only and no error text.
3. Use the PNGs in the PR body, as AGENTS.md requires. Do not commit `out/`.

If the script fails, fix the cause and rerun it from step 1. Do not capture by hand.

## Hard rules

- Sample data only: the seeds in `docs/screenshots/seed/`. Never read the user's real settings, statistics, token or dictionary files.
- Never point a profile at port 11434. The core starts Ollama for it.
- Keep everything on 127.0.0.1.
- The script passes the core only the sandbox environment, so no `GC_*` variable from the shell reaches it.
