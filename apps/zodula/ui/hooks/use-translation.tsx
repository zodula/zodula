import { zodula } from "@/zodula/client/zodula";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useDocList } from "./use-doc-list";
import { useDoc } from "./use-doc";

// Language store - persisted in localStorage
export interface LanguageStore {
    currentLanguage: string;
    setLanguage: (language: string) => void;
    defaultLanguage: string | null;
    setDefaultLanguage: (language: string | null) => void;
}

// Translation store - not persisted, refetches on page reload
export interface TranslationStore {
    translations: Zodula.SelectDoctype<"zodula__Translation">[];
    setTranslations: (translations: Zodula.SelectDoctype<"zodula__Translation">[]) => void;
    getTranslation: (key: string) => Zodula.SelectDoctype<"zodula__Translation"> | undefined;
    setTranslation: (key: string, translation: Zodula.SelectDoctype<"zodula__Translation">) => void;
    deleteTranslation: (key: string) => void;
    isLoaded: boolean; // Track if translations have been loaded in this session
    // Cache for translation lookups
    translationCache: Map<string, string>;
    patternCache: Map<string, { key: string; variables: TranslationVariables }>;
    // Languages with flag emojis
    languages: Zodula.SelectDoctype<"zodula__Language">[];
    setLanguages: (languages: Zodula.SelectDoctype<"zodula__Language">[]) => void;
}

// Type for auto-detected translation variables
type TranslationVariables = Record<string, string | number>;

// Language store - persisted in localStorage
const useLanguageStore = create<LanguageStore>()(
    persist(
        (set) => ({
            currentLanguage: "en", // Default language
            defaultLanguage: null,
            setLanguage: (language: string) => set({ currentLanguage: language }),
            setDefaultLanguage: (language: string | null) => set({ defaultLanguage: language }),
        }),
        {
            name: "zodula-language-storage", // unique name for localStorage key
        }
    )
)

// Translation store - not persisted, refetches on page reload
const useTranslationStore = create<TranslationStore>((set, get) => ({
    translations: [],
    translationCache: new Map(),
    patternCache: new Map(),
    isLoaded: false, // Track if translations have been loaded in this session
    languages: [],
    setTranslations: (translations: Zodula.SelectDoctype<"zodula__Translation">[]) => {
        set({
            translations,
            translationCache: new Map(), // Clear cache when translations change
            patternCache: new Map(),
            isLoaded: true
        });
    },
    setLanguages: (languages: Zodula.SelectDoctype<"zodula__Language">[]) => {
        set({ languages });
    },
    getTranslation: (text: string) => get().translations.find((translation) => translation.translation === text),
    setTranslation: (key: string, translation: Zodula.SelectDoctype<"zodula__Translation">) => set({ translations: get().translations.map((translation) => translation.key === key ? translation : translation) }),
    deleteTranslation: (key: string) => set({ translations: get().translations.filter((translation) => translation.key !== key) }),
}))

export const useTranslation = (lang?: string) => {
    // Use language store for language management
    const { currentLanguage, setLanguage, defaultLanguage, setDefaultLanguage } = useLanguageStore();

    // Use translation store for translation data
    const { translations, setTranslations, getTranslation, setTranslation, deleteTranslation, translationCache, patternCache, isLoaded, languages, setLanguages } = useTranslationStore();

    // Use provided language or current language from store
    const activeLanguage = lang || currentLanguage;

    // Use useDocList for fully-loaded doctypes (will use cache)
    // Note: For fully-loaded doctypes, all fields are fetched regardless of limit/sort params
    // The limit/sort params here are for client-side filtering after fetch
    const { docs: languageDocs } = useDocList({
        doctype: "zodula__Language",
        limit: 1000,
        sort: "name",
        order: "asc"
    });

    const { docs: translationDocs } = useDocList({
        doctype: "zodula__Translation",
        limit: 1000000,
        sort: "key",
        order: "asc"
    });

    // Use useDoc for Global Setting (single doctype)
    const { doc: websiteSetting } = useDoc({
        doctype: "zodula__Global Setting"
    });

    // Update languages when fetched
    useEffect(() => {
        if (languageDocs && languageDocs.length > 0) {
            setLanguages(languageDocs as Zodula.SelectDoctype<"zodula__Language">[]);
        }
    }, [languageDocs, setLanguages]);

    // Update translations when fetched (only once per session)
    useEffect(() => {
        if (translationDocs && translationDocs.length > 0 && !isLoaded) {
            setTranslations(translationDocs as Zodula.SelectDoctype<"zodula__Translation">[]);
        }
    }, [translationDocs, setTranslations, isLoaded]);

    // Update default language from Global Setting
    useEffect(() => {
        const defaultLang = (websiteSetting as any)?.default_language;
        if (defaultLang) {
            setDefaultLanguage(defaultLang);
            // Only set language from Global Setting if no language preference is persisted
            // Check if this is the initial load (no persisted language preference)
            const persistedLanguage = localStorage.getItem("zodula-language-storage");
            if (!persistedLanguage && currentLanguage === "en" && !lang) {
                setLanguage(defaultLang);
            }
        }
    }, [websiteSetting, setDefaultLanguage, setLanguage, currentLanguage, lang]);

    // Helper function to replace template variables in translation strings
    const replaceTemplateVariables = (template: string, variables: TranslationVariables = {}): string => {
        return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
            const value = variables[variableName];
            return value !== undefined ? String(value) : match;
        });
    };

    // Helper function to auto-detect variables from a string like "Welcome, John"
    const autoDetectVariables = (inputString: string, translationKey: string): TranslationVariables => {
        const variables: TranslationVariables = {};

        // Extract template variables from the translation key (e.g., "Welcome, {{name}}" -> ["name"])
        const templateMatches = translationKey.match(/\{\{(\w+)\}\}/g);
        if (!templateMatches) return variables;

        // Extract the template pattern without variables (e.g., "Welcome, {{name}}" -> "Welcome, ")
        const templatePattern = translationKey.replace(/\{\{(\w+)\}\}/g, '{{}}');

        // Create a regex pattern to match the input string
        // Replace {{}} with capture groups
        const regexPattern = templatePattern.replace(/\{\{\}\}/g, '(.+?)');
        const regex = new RegExp(`^${regexPattern}$`);

        const match = inputString.match(regex);
        if (match) {
            // Extract variable names and their values
            templateMatches.forEach((templateVar, index) => {
                const varName = templateVar.replace(/\{\{|\}\}/g, '');
                const varValue = match[index + 1]; // +1 because match[0] is the full match
                if (varValue) {
                    variables[varName] = varValue;
                }
            });
        }

        return variables;
    };

    // Helper function to get translation filtered by language
    const getTranslationByLanguage = (key: string) => {
        return translations.find((translation) =>
            translation.key === key &&
            translation.language === activeLanguage
        );
    };

    // Helper function to find the best matching translation key
    const findBestTranslationKey = (inputString: string): string | null => {
        // First, try exact match with language filter
        const exactMatch = getTranslationByLanguage(inputString);
        if (exactMatch) return inputString;

        // Then, try to find a template pattern that matches with language filter
        for (const translation of translations) {
            if (translation.key.includes('{{') && translation.language === activeLanguage) {
                const templatePattern = translation.key.replace(/\{\{(\w+)\}\}/g, '{{}}');
                const regexPattern = templatePattern.replace(/\{\{\}\}/g, '(.+?)');
                const regex = new RegExp(`^${regexPattern}$`);

                if (regex.test(inputString)) {
                    return translation.key;
                }
            }
        }

        return null;
    };

    const translate = useCallback((key: string) => {
        // Create cache key with language to avoid conflicts
        const cacheKey = `${activeLanguage}:${key}`;
        // Check cache first
        if (translationCache.has(cacheKey)) {
            return translationCache.get(cacheKey)!;
        }

        // Find the best matching translation key
        const bestKey = findBestTranslationKey(key);
        const translation = bestKey ? getTranslationByLanguage(bestKey) : getTranslationByLanguage(key);
        const translationText = translation?.translation || key;

        // If we found a template-based translation, auto-detect variables
        if (bestKey && bestKey !== key && bestKey.includes('{{')) {
            // Check pattern cache for this input
            if (patternCache.has(cacheKey)) {
                const cached = patternCache.get(cacheKey)!;
                const result = replaceTemplateVariables(translationText, cached.variables);
                translationCache.set(cacheKey, result);
                return result;
            }

            const autoDetectedVars = autoDetectVariables(key, bestKey);
            const result = replaceTemplateVariables(translationText, autoDetectedVars);

            // Cache the pattern match and result
            patternCache.set(cacheKey, { key: bestKey, variables: autoDetectedVars });
            translationCache.set(cacheKey, result);
            return result;
        }

        // Cache the result
        translationCache.set(cacheKey, translationText);
        return translationText;
    }, [activeLanguage, translations, translationCache, patternCache])
    // Legacy fetch functions kept for backward compatibility (but they do nothing now)
    const fetchTranslations = useCallback(async () => {
        // No-op: translations are now fetched via useDocList
        console.warn("fetchTranslations is deprecated. Translations are automatically fetched via useDocList.");
    }, []);

    const fetchLanguages = useCallback(async () => {
        // No-op: languages are now fetched via useDocList
        console.warn("fetchLanguages is deprecated. Languages are automatically fetched via useDocList.");
    }, []);

    return {
        t: translate,
        translations,
        fetchTranslations,
        currentLanguage: activeLanguage,
        setLanguage,
        defaultLanguage,
        availableLanguages: languages.map(lang => ({
            code: lang.abbr,
            name: lang.name,
            flag: lang.flag_emoji
        })),
        languages,
        fetchLanguages,
    }
}