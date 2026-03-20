import { Command } from "nailgun";
import { watch, type FSWatcher } from "fs";
import path from "path";
import { hotReload, startup } from "@/zodula/server/startup";
import { startServer } from "@/zodula/server/serve";

// ---------------------------------------------------------------------------
// Watcher state
// ---------------------------------------------------------------------------

let appsWatcher: FSWatcher | null = null;
let triggerWatcher: FSWatcher | null = null;
let signalsRegistered = false;

/**
 * How long (ms) to wait for additional filesystem events before processing.
 * A short window batches rapid-fire saves (e.g. formatter + linter running
 * together) into one HMR pass.
 */
const DEBOUNCE_DELAY = 150;

// Files that changed within the current debounce window, keyed by their
// normalized relative path.
const pendingFiles = new Set<string>();
let debounceTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// Debounced HMR dispatcher
// ---------------------------------------------------------------------------

/**
 * Queue a changed file.  Pending files are processed together after
 * DEBOUNCE_DELAY ms of silence, which consolidates burst saves into one pass.
 */
function scheduleHMR(relativeFile: string) {
    pendingFiles.add(relativeFile);

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
        debounceTimer = null;

        const files = [...pendingFiles];
        pendingFiles.clear();

        // Group files by plugin type so we fire at most one reload per plugin.
        //
        // The rules are:
        //   • 1 file for a type  →  scoped (file-level) reload via hotReload(path)
        //   • N files for a type →  the first call already resets the array and
        //     re-scans the changed files individually; subsequent calls are cheap
        //     because the array has already been updated.
        //
        // For simplicity we just fire hotReload() per unique changed file.
        // Each plugin's load(filePath) implementation only touches that one entry,
        // so multiple files in the same plugin are handled correctly in sequence.
        for (const file of files) {
            await hotReload(file).catch(err =>
                console.error(`[HMR] error processing ${file}:`, err)
            );
        }
    }, DEBOUNCE_DELAY);
}

// ---------------------------------------------------------------------------
// Dev command
// ---------------------------------------------------------------------------

export default new Command("dev")
    .description("Start the development server with hot module reload")
    .action(async () => {
        // ── 1. Full initial startup ─────────────────────────────────────────
        //    Loads all plugins, validates them, generates types and builds the
        //    frontend bundle exactly once.
        await startup();

        // ── 2. Start the HTTP server in-process (no child subprocess) ───────
        //    startServer() calls server.start() which is non-blocking in Bun:
        //    it returns immediately and Bun keeps the process alive via the
        //    active TCP listener.  File-change reloads update the in-memory
        //    loader state without touching the running server.
        await startServer();

        // ── 3. Watch the apps directory for source changes ──────────────────
        if (appsWatcher) appsWatcher.close();

        const appsPath = path.join(process.cwd(), "apps");

        appsWatcher = watch(appsPath, { recursive: true }, (_eventType, filename) => {
            if (!filename) return;
            if (
                filename.includes("node_modules") ||
                filename.includes(".git")         ||
                filename.includes("fixture.json")
            ) return;

            // fs.watch() returns paths relative to the watched directory.
            // Prefix with "apps/" so paths match cwd-relative patterns used
            // by getHMRScope() (e.g. "apps/zodula/actions/auth/login.ts").
            const relPath = path.join("apps", filename);
            scheduleHMR(relPath);
        });

        // ── 4. Migration trigger ─────────────────────────────────────────────
        //    `nailgun migrate` touches .zodula/.watch_trigger when it finishes.
        //    We respond with a full reload so that schema changes are reflected
        //    without restarting the process.
        const watchTriggerPath = path.join(process.cwd(), ".zodula", ".watch_trigger");
        await Bun.write(watchTriggerPath, "").catch(async () => {
            await Bun.write(path.join(process.cwd(), ".zodula", ".gitkeep"), "");
            await Bun.write(watchTriggerPath, "");
        });

        if (triggerWatcher) triggerWatcher.close();

        triggerWatcher = watch(watchTriggerPath, (eventType) => {
            if (eventType === "change") {
                console.log("🔄 Migration trigger detected — performing full reload…");
                startup()
                    .then(() => console.log("✅ Full reload complete"))
                    .catch(console.error);
            }
        });

        // ── 5. Graceful shutdown ─────────────────────────────────────────────
        if (!signalsRegistered) {
            signalsRegistered = true;

            const shutdown = () => {
                console.log("\n🛑 Shutting down development server…");
                if (debounceTimer)  clearTimeout(debounceTimer);
                if (appsWatcher)    { appsWatcher.close();    appsWatcher    = null; }
                if (triggerWatcher) { triggerWatcher.close(); triggerWatcher = null; }
                process.exit(0);
            };

            process.on("SIGTERM", shutdown);
            process.on("SIGINT",  shutdown);
        }
    });
