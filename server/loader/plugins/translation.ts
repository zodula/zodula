import path from "path";
import fs from "fs";
import { loader } from "..";
import { logger } from "../../logger";
import { Database } from "../../database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslationEntry {
    key: string;
    translation: string;
}

/**
 * In-memory representation of a single translation CSV file.
 * One file = one (language × app × domain) combination.
 */
export interface TranslationFile {
    /** Absolute path to the CSV file on disk */
    filePath: string;
    language: string;
    app: string;
    domain: string;
    entries: TranslationEntry[];
}

// ---------------------------------------------------------------------------
// CSV parser (same rules as the original apply-translation.ts)
// ---------------------------------------------------------------------------

function parseCSV(content: string): TranslationEntry[] {
    const lines = content.trim().split("\n");
    const entries: TranslationEntry[] = [];

    for (const line of lines) {
        if (line.trim() === "") continue;

        const match = line.match(/^"([^"]*)"\s*,\s*"([^"]*)"$/);
        if (match) {
            entries.push({ key: match[1] || "", translation: match[2] || "" });
        }
    }

    return entries;
}

// ---------------------------------------------------------------------------
// TranslationLoader
// ---------------------------------------------------------------------------

export class TranslationLoader {
    private translations: TranslationFile[] = [];

    // -----------------------------------------------------------------------
    // BasePlugin implementation
    // -----------------------------------------------------------------------

    /**
     * Load translation CSV files into memory.
     *
     * @param filePath  When provided, only that file is (re-)loaded — stale
     *                  in-memory data for it is replaced.  Pass the changed
     *                  file path during HMR so new keys are picked up without
     *                  a full scan.
     *                  When omitted, all apps' translation folders are scanned
     *                  from scratch.
     */
    async load(filePath?: string): Promise<TranslationFile[]> {
        if (filePath) {
            const absPath = path.resolve(filePath);
            // Remove the stale entry for this file then re-load it
            this.translations = this.translations.filter(
                (t) => t.filePath !== absPath
            );
            const entry = await this.loadSingleFile(absPath);
            if (entry) this.translations.push(entry);
        } else {
            this.translations = [];
            const apps = loader.from("app").list();

            for (const app of apps) {
                const translationsDir = path.join(app.dir, "translations");
                if (!fs.existsSync(translationsDir)) continue;

                const domainDirs = fs
                    .readdirSync(translationsDir, { withFileTypes: true })
                    .filter((d) => d.isDirectory())
                    .map((d) => d.name);

                for (const domain of domainDirs) {
                    const domainDir = path.join(translationsDir, domain);
                    const files = fs
                        .readdirSync(domainDir)
                        .filter((f) => f.endsWith(".csv"));

                    for (const file of files) {
                        const entry = await this.loadSingleFile(
                            path.resolve(path.join(domainDir, file))
                        );
                        if (entry) this.translations.push(entry);
                    }
                }
            }
        }

        return this.translations;
    }

    list(): TranslationFile[] {
        return this.translations;
    }

    /** Returns all in-memory translation files for a given language. */
    get(language: string): TranslationFile {
        const files = this.translations.filter((t) => t.language === language);
        if (!files.length) {
            throw new Error(`No translations found for language "${language}"`);
        }
        // Return the first match — consumers wanting all files use list()
        return files[0]!;
    }

    async validate(): Promise<void> {
        // No structural validation needed for CSV translations
    }

    // -----------------------------------------------------------------------
    // applyPredefined — syncs in-memory translations to the DB
    // -----------------------------------------------------------------------

    /**
     * Sync translation rows to the database.
     *
     * @param filePath  When provided, only the entries from that specific CSV
     *                  file are upserted and stale rows for that
     *                  (language × app × domain) tuple are removed.
     *                  When omitted, all in-memory translations are synced and
     *                  any rows that no longer exist in any CSV are deleted.
     */
    async applyPredefined(filePath?: string): Promise<void> {
        const db = Database("main");

        const toProcess = filePath
            ? this.translations.filter(
                  (t) => t.filePath === path.resolve(filePath)
              )
            : this.translations;

        if (toProcess.length === 0 && !filePath) {
            logger.info("No translation files loaded, skipping sync");
            return;
        }

        const allProcessedIds: string[] = [];

        for (const tf of toProcess) {
            const fileProcessedIds: string[] = [];

            for (const entry of tf.entries) {
                const id = `${tf.language}--${tf.app}--${tf.domain}--${entry.key}`;
                await this.upsertTranslation(
                    db,
                    tf.language,
                    tf.app,
                    tf.domain,
                    entry.key,
                    entry.translation
                );
                fileProcessedIds.push(id);
                allProcessedIds.push(id);
            }

            if (filePath) {
                // Scoped cleanup: remove orphaned rows only within this
                // (language × app × domain) tuple so we never touch other files.
                if (fileProcessedIds.length > 0) {
                    await (db as any)
                        .delete("Translation")
                        .where("language", "=", tf.language)
                        .where("app", "=", tf.app)
                        .where("domain", "=", tf.domain)
                        .where("id", "NOT IN", fileProcessedIds)
                        .execute();
                } else {
                    // The file is now empty — remove all rows for this tuple
                    await (db as any)
                        .delete("Translation")
                        .where("language", "=", tf.language)
                        .where("app", "=", tf.app)
                        .where("domain", "=", tf.domain)
                        .execute();
                }
            }
        }

        if (!filePath) {
            // Full cleanup: remove any translation rows that are no longer in
            // any loaded CSV file.
            if (allProcessedIds.length > 0) {
                await (db as any)
                    .delete("Translation")
                    .where("id", "NOT IN", allProcessedIds)
                    .execute();
            }
        }

        logger.info(
            `Synced ${allProcessedIds.length} translation entries` +
                (filePath ? ` from ${path.basename(filePath)}` : " (full run)")
        );
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Read and parse a single CSV file.
     * The file must live at:  apps/<appFolder>/translations/<domain>/<language>.csv
     */
    private async loadSingleFile(
        absPath: string
    ): Promise<TranslationFile | null> {
        try {
            // Normalise separators on Windows
            const normalized = absPath.replace(/\\/g, "/");
            const match = normalized.match(
                /apps\/([^/]+)\/translations\/([^/]+)\/([^/]+)\.csv$/
            );
            if (!match) {
                logger.warn(
                    `Translation file does not match expected path convention: ${absPath}`
                );
                return null;
            }

            const appFolder = match[1]!;
            const domain = match[2]!;
            const language = match[3]!;

            // Resolve the app package name from its folder name
            const appMeta = loader
                .from("app")
                .list()
                .find((a) => a.folder === appFolder);
            const appName = appMeta?.packageName ?? appFolder;

            const content = fs.readFileSync(absPath, "utf-8");
            const entries = parseCSV(content);

            logger.info(
                `Loaded ${entries.length} translations [${language}] ${appName}/${domain}`
            );

            return { filePath: absPath, language, app: appName, domain, entries };
        } catch (error) {
            logger.error(`Failed to load translation file ${absPath}:`, error);
            return null;
        }
    }

    private async upsertTranslation(
        db: any,
        language: string,
        app: string,
        domain: string,
        key: string,
        translation: string
    ): Promise<void> {
        const timestamp = $zodula.utils.format(new Date(), "datetime");
        const id = `${language}--${app}--${domain}--${key}`;

        const payload = {
            id,
            language,
            key,
            translation,
            app,
            domain,
            idx: 0,
            vector: "[]",
            owner: null,
            created_by: null,
            updated_by: null,
            created_at: timestamp,
            updated_at: timestamp,
            doc_status: "Draft" as const,
        } satisfies Required<Zodula.SelectDoctype<"Translation">>;

        try {
            const existing = await db
                .select("*")
                .from("Translation")
                .where("id", "=", id)
                .first();

            if (existing) {
                await db
                    .update("Translation")
                    .set(payload)
                    .where("id", "=", id)
                    .execute();
            } else {
                await db.insert("Translation").values(payload).execute();
            }
        } catch (error) {
            logger.error(
                `Failed to upsert translation ${id}:`,
                error
            );
        }
    }
}
