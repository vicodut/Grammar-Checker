// Fails when a .ts/.tsx file under apps/ or packages/ is over 200 lines, or a function body is
// over 40 lines. Generated files (*.generated.*) are exempt. Run with `bun run size`.
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { checkSource, formatViolation, type SizeViolation } from "./size-check.rules";

const root = join(import.meta.dir, "..");
const SOURCE_ROOTS = ["apps", "packages"];
// Build output (gitignored): the declaration files `tsc -b` writes under build/.
const SKIPPED_DIRS = new Set(["node_modules", "dist", "build", "out", ".git"]);

const isSourceFile = (name: string): boolean => /\.tsx?$/.test(name) && !/\.generated\./.test(name);

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(path);
      return entry.isFile() && isSourceFile(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}

async function main(): Promise<void> {
  const files = (
    await Promise.all(SOURCE_ROOTS.map((dir) => listSourceFiles(join(root, dir))))
  ).flat();
  const violations: SizeViolation[] = [];
  for (const file of files.sort()) {
    const path = relative(root, file);
    violations.push(...checkSource(path, await readFile(file, "utf8")));
  }
  if (violations.length === 0) return;
  for (const violation of violations) process.stderr.write(`${formatViolation(violation)}\n`);
  process.exit(1);
}

await main();
