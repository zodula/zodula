import { format as dateFormat, formatDistanceToNow, isValid, parse } from "date-fns"
import { ClientFieldHelper } from "./field"

export let BASE_URL = "http://localhost:3000"
if (typeof window !== "undefined") {
    BASE_URL = process.env.NODE_ENV === "development" ? "http://localhost:3000" : window.location.origin
}

export const format = (data: Date | string, format: "date" | "datetime" | "time" = "datetime") => {
    let dateFormatString = "yyyy-MM-dd HH:mm:ss"
    switch (format) {
        case "date":
            dateFormatString = "yyyy-MM-dd"
            break
        case "time":
            dateFormatString = "HH:mm:ss"
            break
        default:
            dateFormatString = "yyyy-MM-dd HH:mm:ss"
            break
    }
    if (data instanceof Date) {
        return dateFormat(data, dateFormatString)
    }
    return dateFormat(new Date(data), dateFormatString)
}

export function formatTimeAgo(dateString: string) {
    const date = parseDate(dateString);
    if (!date) return '-';

    return formatDistanceToNow(date);
}

export function parseDate(
    dateString: string,
    referenceDate = new Date()
): Date | null {
    const formats = ["dd-MM-yyyy", "dd-MM-yyyy HH:mm:ss", "HH:mm:ss", "yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"]
    for (const fmt of formats) {
        try {
            const parsed = parse(dateString, fmt, referenceDate);
            if (isValid(parsed)) {
                return parsed;
            }
        } catch (error) {
            continue
        }
    }
    return null; // none matched
}

export function getDefaultValue(field: Zodula.Field) {
    if (!field?.default) return field?.default;

    if (typeof field.default === "string") {
        // TODO: ry to use plugin for types
        if (field.default.toUpperCase() === "NOW()") {
            const now = new Date();

            // Format based on field type
            if (["Date", "Datetime"].includes(field.type as any)) {
                // Format: DD-MM-YYYY (UTC)
                const day = String(now.getUTCDate()).padStart(2, '0');
                const month = String(now.getUTCMonth() + 1).padStart(2, '0');
                const year = now.getUTCFullYear();
                return `${year}-${month}-${day}`;
            } else if (["Time"].includes(field.type as any)) {
                // Format: HH:mm:ss (UTC)
                const hours = String(now.getUTCHours()).padStart(2, '0');
                const minutes = String(now.getUTCMinutes()).padStart(2, '0');
                const seconds = String(now.getUTCSeconds()).padStart(2, '0');
                return `${hours}:${minutes}:${seconds}`;
            }

            const day = String(now.getUTCDate()).padStart(2, '0');
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const year = now.getUTCFullYear();
            const hours = String(now.getUTCHours()).padStart(2, '0');
            const minutes = String(now.getUTCMinutes()).padStart(2, '0');
            const seconds = String(now.getUTCSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }
        if (field.default.toUpperCase() === "TODAY()") {
            const now = new Date();

            // Format based on field type
            if (["Datetime"].includes(field.type as any)) {
                // Format: DD-MM-YYYY HH:mm:ss (UTC)
                const day = String(now.getUTCDate()).padStart(2, '0');
                const month = String(now.getUTCMonth() + 1).padStart(2, '0');
                const year = now.getUTCFullYear();
                const hours = "00"
                const minutes = "00"
                const seconds = "00"
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            } else if (["Time"].includes(field.type as any)) {
                // Format: HH:mm:ss (UTC)
                const hours = "00"
                const minutes = "00"
                const seconds = "00"
                return `${hours}:${minutes}:${seconds}`;
            }

            const day = String(now.getUTCDate()).padStart(2, '0');
            const month = String(now.getUTCMonth() + 1).padStart(2, '0');
            const year = now.getUTCFullYear();
            return `${year}-${month}-${day}`;
        }
    }

    return field.default;
}

export const isStandardField = (name: string) => {
    return Object.keys(ClientFieldHelper.standardFields()).includes(name)
}

// Utility functions that work on both client and server
const genRanHex = (size: number) => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

const generateUUIDv7 = () => {
    // Simple UUID v7 implementation for client compatibility
    const timestamp = Date.now()
    const random = Math.random().toString(16).substring(2, 14)
    return `${timestamp.toString(16).padStart(12, '0')}-7${random.substring(0, 3)}-${random.substring(3, 7)}-${random.substring(7, 11)}-${random.substring(11)}`
}

const getUtilValue = (util: string): string => {
    const now = new Date()
    switch (util) {
        case "YYYY":
            return now.getFullYear().toString().padStart(4, "0")
        case "MM":
            // Note: This handles both month and minute patterns from the original naming function
            // The original had a conflict where MM was used for both month and minutes
            // We'll default to month here, but this should be addressed in the naming series format
            return (now.getMonth() + 1).toString().padStart(2, "0")
        case "DD":
            return now.getDate().toString().padStart(2, "0")
        case "HH":
            return now.getHours().toString().padStart(2, "0")
        case "SS":
            return now.getSeconds().toString().padStart(2, "0")
        case "SSS":
            return now.getMilliseconds().toString().padStart(3, "0")
        case "T":
            return now.getTime().toString()
        case "HEX":
            return genRanHex(16)
        case "8HEX":
            return genRanHex(8)
        case "16HEX":
            return genRanHex(16)
        case "UUID":
            // Use Bun.randomUUIDv7() if available (server-side), otherwise fallback
            if (typeof Bun !== 'undefined' && Bun.randomUUIDv7) {
                return Bun.randomUUIDv7()
            }
            return generateUUIDv7()
        default:
            return ""
    }
}

export const getFieldValueFromDoc = (value: string, doc: Zodula.SelectDoctype<any>, config?: Zodula.Field) => {
    if (!value || !doc) return value

    let result = value
    
    // Handle field patterns {{field}}
    const fieldRegex = /\{\{(.*?)\}\}/g
    const fieldMatches = result.match(fieldRegex) || []
    for (const fieldMatch of fieldMatches) {
        const field = fieldMatch.replaceAll("{{", "").replaceAll("}}", "")
        const fieldValue = doc?.[field as keyof Zodula.SelectDoctype<any>]?.toString() || ""
        result = result.replace(fieldMatch, fieldValue)
    }
    
    // Handle utility patterns {UTIL}
    const utilRegex = /\{([A-Z]+)\}/g
    const utilMatches = result.match(utilRegex) || []
    for (const utilMatch of utilMatches) {
        const util = utilMatch.replaceAll("{", "").replaceAll("}", "")
        const utilValue = getUtilValue(util)
        result = result.replace(utilMatch, utilValue)
    }
    
    return result
}

export function getDoctypeFileUrl(doctype: Zodula.DoctypeName, docId: string, fieldName: string, fileName: string) {
    return [BASE_URL, "files", doctype, docId || doctype, fieldName, fileName].join("/");
}

export function safeEval(code: string, context = {}) {
    const keys = Object.keys(context);
    const values = Object.values(context);

    // Build a function where variables are destructured
    const fn = new Function(...keys, `"use strict"; return eval(${JSON.stringify(code)});`);

    return fn(...values);
}

export function getFormatFieldConfig(fieldConfig: Zodula.Field, doc: any) {
    let config = { ...fieldConfig }
    if (!doc) {
        return config
    }
    if (!!config?.readonly_on) {
        config.readonly = safeEval(config?.readonly_on, { doc: doc })
    }
    if (!!config?.required_on) {
        config.required = safeEval(config?.required_on, { doc: doc })
    }
    if (!!config?.depends_on) {
        config.hidden = safeEval(config?.depends_on, { doc: doc }) ? 0 : 1
    }
    return config
}