/**
 * apply-translation.ts
 *
 * Thin shim kept for backward-compatibility.  All logic has moved into
 * TranslationLoader (server/loader/plugins/translation.ts) which is
 * registered as the "translation" plugin on the shared loader instance.
 *
 * The loader plugin provides:
 *   - TranslationLoader.load(filePath?)         — scan / HMR-reload CSVs
 *   - TranslationLoader.applyPredefined(filePath?) — sync to DB, scoped or full
 *
 * Callers should prefer `loader.applyPredefined("translation")` or
 * `loader.applyPredefined()` (full run) going forward.
 */
import { loader } from "@/zodula/server/loader";

/** @deprecated Use `loader.applyPredefined("translation")` instead. */
export const applyTranslation = async (): Promise<void> => {
    await loader.applyPredefined("translation");
};
