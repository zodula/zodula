import { zodula } from "../.."

declare global {
    var $translation: Zodula.SelectDoctype<"zodula__Translation">[]
}

export const extendTranslation = async () => {
    const translations = await zodula.doctype("zodula__Translation").select().fields(["key", "translation", "language"]).bypass(true)
    global.$translation = translations.docs
}

// Type for auto-detected translation variables
type TranslationVariables = Record<string, string | number>;

// Cache for translation lookups
const translationCache = new Map<string, string>();
const patternCache = new Map<string, { key: string; variables: TranslationVariables }>();

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
const getTranslationByLanguage = (key: string, language: string) => {
    return global.$translation.find((translation) =>
        translation.key === key &&
        translation.language === language
    );
};

// Helper function to find the best matching translation key
const findBestTranslationKey = (inputString: string, language: string): string | null => {
    // First, try exact match with language filter
    const exactMatch = getTranslationByLanguage(inputString, language);
    if (exactMatch) return inputString;

    // Then, try to find a template pattern that matches with language filter
    for (const translation of global.$translation) {
        if (translation.key.includes('{{') && translation.language === language) {
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

export const translate = (key: string, language: string = process.env.ZODULA_PUBLIC_DEFAULT_LANGUAGE || "en") => {
    // Create cache key with language to avoid conflicts
    const cacheKey = `${language}:${key}`;
    
    // Check cache first
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    // Find the best matching translation key
    const bestKey = findBestTranslationKey(key, language);
    const translation = bestKey ? getTranslationByLanguage(bestKey, language) : getTranslationByLanguage(key, language);
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
};