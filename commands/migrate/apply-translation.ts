import { loader } from "../../server/loader";
import path from "path";
import { $ } from "bun";
import type { Bunely } from "bunely";
import { logger } from "../../server/logger";
import fs from "fs";
import { Database } from "@/zodula/server/database";

interface TranslationEntry {
  key: string;
  translation: string;
}

interface ProcessedTranslations {
  language: string;
  app: string;
  domain: string;
  entries: TranslationEntry[];
}

interface UpsertResult {
  success: boolean;
  error?: string;
}

// Utility functions
function createTimestamp(): string {
  return $zodula.utils.format(new Date(), "datetime");
}

function createBasePayload(): {
  owner: null;
  created_by: null;
  updated_by: null;
  created_at: string;
  updated_at: string;
  doc_status: 0;
} {
  const timestamp = createTimestamp();
  return {
    owner: null,
    created_by: null,
    updated_by: null,
    created_at: timestamp,
    updated_at: timestamp,
    doc_status: 0,
  };
}

// Parse CSV content
function parseCSV(content: string): TranslationEntry[] {
  const lines = content.trim().split("\n");
  const entries: TranslationEntry[] = [];

  for (const line of lines) {
    if (line.trim() === "") continue;

    // Simple CSV parsing - handles quoted strings
    const match = line.match(/^"([^"]*)"\s*,\s*"([^"]*)"$/);
    if (match) {
      entries.push({
        key: match[1] || "",
        translation: match[2] || "",
      });
    }
  }

  return entries;
}

// Load translation files from app's translations folder
async function loadTranslationFiles(): Promise<ProcessedTranslations[]> {
  const apps = loader.from("app").list();
  const processedTranslations: ProcessedTranslations[] = [];

  for (const app of apps) {
    const translationsDir = path.join(app.dir, "translations");

    // Check if translations directory exists
    if (!fs.existsSync(translationsDir)) {
      logger.info(`No translations directory found for app ${app.packageName}`);
      continue;
    }

    // Find all domain directories in translations folder
    const domainDirs = fs
      .readdirSync(translationsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const domain of domainDirs) {
      const domainDir = path.join(translationsDir, domain);

      // Find all CSV files in domain directory
      const files = fs
        .readdirSync(domainDir)
        .filter((file) => file.endsWith(".csv"));

      for (const file of files) {
        const language = path.basename(file, ".csv");
        const filePath = path.join(domainDir, file);

        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const entries = parseCSV(content);

          if (entries.length > 0) {
            processedTranslations.push({
              language,
              app: app.packageName,
              domain,
              entries,
            });
            logger.info(
              `Loaded ${entries.length} translations for ${language} in app ${app.packageName}/${domain}`
            );
          }
        } catch (error) {
          logger.error(`Failed to load translation file ${filePath}: ${error}`);
        }
      }
    }
  }

  return processedTranslations;
}

// Upsert translation
async function upsertTranslation(
  trx: Bunely,
  language: string,
  app: string,
  domain: string,
  key: string,
  translation: string
): Promise<UpsertResult> {
  try {
    const id = `${language}--${app}--${domain}--${key}`;
    const basePayload = createBasePayload();
    const translationPayload = {
      id,
      language,
      key,
      translation,
      app,
      domain,
      idx: 0,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"zodula__Translation">>;

    const isExist = await trx
      .select("*")
      .from("zodula__Translation")
      .where("id", "=", id)
      .first();

    if (isExist) {
      await trx
        .update("zodula__Translation")
        .set(translationPayload)
        .where("id", "=", id)
        .execute();
    } else {
      await trx
        .insert("zodula__Translation")
        .values(translationPayload)
        .execute();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to upsert translation ${language}.${app}.${domain}.${key}: ${error}`,
    };
  }
}

// Process translations for a specific language and app
async function processTranslations(
  trx: Bunely,
  processedTranslation: ProcessedTranslations
): Promise<{ processedTranslationIds: string[] }> {
  const processedTranslationIds: string[] = [];

  // Process each translation entry
  for (const entry of processedTranslation.entries) {
    const translationResult = await upsertTranslation(
      trx,
      processedTranslation.language,
      processedTranslation.app,
      processedTranslation.domain,
      entry.key,
      entry.translation
    );

    if (translationResult.success) {
      processedTranslationIds.push(
        `${processedTranslation.language}--${processedTranslation.app}--${processedTranslation.domain}--${entry.key}`
      );
    } else {
      logger.error(translationResult.error);
    }
  }

  return { processedTranslationIds };
}

// Cleanup orphaned translations
async function cleanupOrphanedTranslations(
  trx: Bunely,
  processedTranslationIds: string[]
): Promise<void> {
  try {
    if (processedTranslationIds.length > 0) {
      await trx
        .delete("zodula__Translation")
        .where("id", "NOT IN", processedTranslationIds)
        .execute();
    }
  } catch (error) {
    logger.error("Failed to cleanup orphaned translations:", error);
    throw error;
  }
}

export const applyTranslation = async (): Promise<void> => {
  try {
    const trx = Database("main");
    logger.info("Loading translation files...");
    const processedTranslations = await loadTranslationFiles();

    if (processedTranslations.length === 0) {
      logger.info("No translation files found");
      return;
    }

    const allProcessedTranslationIds: string[] = [];

    // Process each translation file
    for (const processedTranslation of processedTranslations) {
      try {
        const result = await processTranslations(trx, processedTranslation);
        allProcessedTranslationIds.push(...result.processedTranslationIds);
      } catch (error) {
        logger.error(
          `Error processing translations for ${processedTranslation.language} in ${processedTranslation.app}/${processedTranslation.domain}:`,
          error
        );
      }
    }

    // Clean up orphaned translations
    try {
      await cleanupOrphanedTranslations(trx, allProcessedTranslationIds);
    } catch (error) {
      logger.error("Error during translation cleanup:", error);
      throw error;
    }

    logger.info(
      `Processed ${allProcessedTranslationIds.length} translations from ${processedTranslations.length} files`
    );
  } catch (error) {
    logger.error("Critical error in applyTranslation:", error);
    throw error;
  }
};
