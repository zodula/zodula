import { Command } from "nailgun";
import * as fs from "node:fs";
import path from "path";

const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".zodula",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

function collectTestFiles(rootDir: string): string[] {
  const results: string[] = [];
  const stack: string[] = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop()!;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".test.ts")) continue;

      const rel = path.relative(rootDir, fullPath).split(path.sep).join("/");
      results.push(`./${rel}`);
    }
  }

  return results.sort();
}

export default new Command("test")
  .description("Run all *.test.ts files (Bun test runner)")
  .option(
    "--preload <path>",
    "Bun test --preload script path",
    "./apps/zodula/test/utils.ts"
  )
  .action(async (options) => {
    const rootDir = process.cwd();
    const preloadPath: string = options["preload"];

    // Ensure we run against a disposable DB schema.
    // This matches the remapping logic in `apps/zodula/server/database/database.ts`.
    process.env.ZODULA_DB_MAIN ??= "test";

    const testFiles = collectTestFiles(rootDir);

    if (testFiles.length === 0) {
      console.log("No *.test.ts files found. Skipping.");
      process.exit(0);
    }

    const cmd = ["bun", "test", "--preload", preloadPath, ...testFiles];

    const proc = Bun.spawn({
      cmd,
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    });

    await proc.exited;

    // If tests remap `Database("main")` to a disposable schema (default: `test`),
    // delete it after the bun test runner exits.
    //
    // This is done in the parent `ngun test` process so SQLite file handles
    // are already closed by the time we remove the DB files.
    const exitCode = proc.exitCode ?? 1;
    try {
      const zodulaDbMain = process.env.ZODULA_DB_MAIN;
      if (zodulaDbMain && zodulaDbMain !== "main") {
        const { DatabaseHelper } = await import(
          "@/zodula/server/database/database"
        );
        DatabaseHelper.deleteDatabase("main");
      }
    } catch {
      // Best-effort cleanup; never mask the test result.
    }

    process.exit(exitCode);
  });

