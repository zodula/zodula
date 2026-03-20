/// <reference path="./doctype.d.ts" />
import prepareScript from "@/zodula/server/prepare";
import { buildIndexJs, prepareApp } from "@/zodula/server/prepare/tsxPage";
import { loader } from "@/zodula/server/loader";
import { migrationHandler } from "@/zodula/server/handler/migration";
import { zodula } from "@/zodula/server/zodula";
import { SyncMigrator } from "@/zodula/server/migrator/migrator.sync";
import path from "path"
import { logger } from "@/zodula/server/logger";

global.$migration = migrationHandler;
global.$zodula = zodula;
global.$loader = loader;
global.$doctype = loader.from("doctype").$doctype;
global.$extend = loader.from("extend").$extend;
global.$action = loader.from("action").$action;
global.$background = loader.from("background").$background;

export async function startup() {
    await loader.load()
    await loader.validate()
    await prepareScript()
}

// ---------------------------------------------------------------------------
// HMR — Hot Module Reload
// ---------------------------------------------------------------------------

/**
 * Maps a changed file to the loader plugin type that owns it, plus flags that
 * control which follow-up work is needed after the reload.
 */
interface HMRScope {
    /**
     * Loader plugin type to reload.
     * When undefined, no loader.load() is called — only the follow-up work
     * (validation, UI rebuild) defined by the other flags is performed.
     */
    type?: string
    /**
     * Absolute or cwd-relative path to reload within the plugin.
     * Undefined means "reload the whole plugin" (used when per-file scope is
     * too complex, e.g. doctypes with cross-doctype relationships).
     */
    filePath?: string
    /** Whether to re-validate the plugin after reload (type generation, etc.) */
    needsValidate: boolean
    /** Whether to rebuild the frontend bundle after reload */
    needsUIRebuild: boolean
}

function getHMRScope(changedFile: string): HMRScope | null {
    // Normalise backslashes on Windows
    const f = changedFile.replace(/\\/g, "/")

    // server actions
    if (/apps\/[^/]+\/actions\/.*\.ts$/.test(f))
        return { type: "action", filePath: changedFile, needsValidate: true, needsUIRebuild: false }

    // doctypes — full reload (cross-doctype relatives must be rebuilt) but the
    // changed file's cache is busted via filePath so new fields are picked up
    if (/apps\/[^/]+\/doctypes\/[^/]+\/[^/]+\/[^/]+\.doctype\.ts$/.test(f))
        return { type: "doctype", filePath: changedFile, needsValidate: true, needsUIRebuild: false }

    // pages & shell — loader reload + bundle rebuild
    if (/apps\/[^/]+\/ui\/pages\/.*(page|shell)\.tsx$/.test(f))
        return { type: "page", filePath: undefined, needsValidate: false, needsUIRebuild: true }

    // background jobs
    if (/apps\/[^/]+\/background\/.*\.ts$/.test(f))
        return { type: "background", filePath: changedFile, needsValidate: true, needsUIRebuild: false }

    // server extend handlers
    if (/apps\/[^/]+\/scripts\/.*\.extend\.ts$/.test(f))
        return { type: "extend", filePath: changedFile, needsValidate: false, needsUIRebuild: false }

    // UI scripts (.ui.tsx) — loader reload + bundle rebuild
    if (/\.ui\.tsx$/.test(f))
        return { type: "ui-script", filePath: changedFile, needsValidate: false, needsUIRebuild: true }

    // translation CSV files
    if (/apps\/[^/]+\/translations\/[^/]+\/[^/]+\.csv$/.test(f))
        return { type: "translation", filePath: changedFile, needsValidate: false, needsUIRebuild: false }

    // Any other file inside apps/*/ui/** (components, hooks, utils, etc.)
    // No loader reload needed — just rebuild the frontend bundle.
    if (/apps\/[^/]+\/ui\/.*\.(tsx|ts)$/.test(f))
        return { type: undefined, needsValidate: false, needsUIRebuild: true }

    return null // unrecognised file — skip
}

/**
 * Perform a targeted hot reload for a single changed file.
 *
 * The function:
 * 1. Resolves which loader plugin owns the file.
 * 2. Calls `loader.load(type, filePath?)` — scoped to that plugin (and optionally
 *    to that single file) so the rest of the loader state is untouched.
 * 3. Optionally re-validates and/or rebuilds the frontend bundle.
 *
 * Returns `true` if a reload was performed, `false` if the file was ignored.
 */
export async function hotReload(changedFile: string): Promise<boolean> {
    const scope = getHMRScope(changedFile)
    if (!scope) return false

    const pluginLabel = scope.type ?? "ui-bundle"
    const fileName = path.basename(changedFile)

    logger.info(`[HMR] ${fileName} → ${pluginLabel}`)
    const t0 = Date.now()

    try {
        // Reload the owning plugin (scoped or full), unless this is a bundle-only change
        if (scope.type) {
            await loader.load(scope.type, scope.filePath)

            if (scope.needsValidate) {
                await loader.validate(scope.type)
            }

            if (scope.type === "doctype") {
                // Extract doctype name from the changed file.
                // File convention: …/doctypes/<group>/<DoctypeName>/<DoctypeName>.doctype.ts
                // → strip the ".doctype.ts" suffix to get the exact doctype name.
                const doctypeName = path.basename(scope.filePath!).replace(/\.doctype\.ts$/, "")

                // 1. Scoped schema sync — only add/modify columns for this doctype.
                //    Never destructive during dev (no column/table drops).
                const migrator = new SyncMigrator()
                const diff = await migrator.compare("main", false, [doctypeName])
                await migrator.apply("main", diff, false)

                // 2. Scoped predefined metadata sync — only update rows for this doctype.
                await loader.applyPredefined("doctype", scope.filePath)
            } else {
                // For other plugins run applyPredefined if they support it
                await loader.applyPredefined(scope.type, scope.filePath)
            }
        }

        if (scope.needsUIRebuild) {
            // Re-generate App.tsx then rebuild the browser bundle
            await prepareApp()
            await buildIndexJs()
        }

        logger.success(`[HMR] ${fileName} reloaded in ${Date.now() - t0}ms`)
        return true
    } catch (error) {
        logger.error(`[HMR] ${fileName} failed to reload:`, error)
        return false
    }
}