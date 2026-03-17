import {
    format as dateFormat,
    formatDistanceToNow,
    isValid,
    parse,
    add as dateFnsAdd,
    sub as dateFnsSub,
    addDays as dateFnsAddDays,
    subDays,
} from "date-fns";

export type DateUnit = "days" | "weeks" | "months" | "years" | "hours" | "minutes" | "seconds";

export function format(data: Date | string, fmt: "date" | "datetime" | "time" = "datetime"): string {
    let dateFormatString = "yyyy-MM-dd HH:mm:ss";
    switch (fmt) {
        case "date":
            dateFormatString = "yyyy-MM-dd";
            break;
        case "time":
            dateFormatString = "HH:mm:ss";
            break;
        default:
            dateFormatString = "yyyy-MM-dd HH:mm:ss";
            break;
    }
    if (data instanceof Date) {
        return dateFormat(data, dateFormatString);
    }
    return dateFormat(new Date(data), dateFormatString);
}

export function parseDate(
    dateString: string,
    referenceDate = new Date()
): Date | null {
    const formats = ["dd-MM-yyyy", "dd-MM-yyyy HH:mm:ss", "HH:mm:ss", "yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"];
    for (const fmt of formats) {
        try {
            const parsed = parse(dateString, fmt, referenceDate);
            if (isValid(parsed)) {
                return parsed;
            }
        } catch {
            continue;
        }
    }
    return null;
}

/** Date helper: today(), now(), format(), parse(), add(number, unit), minus(number, unit). */
export class ZodulaDate {
    today(): string {
        return dateFormat(new Date(), "yyyy-MM-dd");
    }
    now(): string {
        return dateFormat(new Date(), "yyyy-MM-dd HH:mm:ss");
    }
    format(data: Date | string, fmt: "date" | "datetime" | "time" = "datetime"): string {
        return format(data, fmt);
    }
    parse(dateString: string): Date | null {
        return parseDate(dateString);
    }
    add(date: Date | string, amount: number, unit: DateUnit): Date {
        const d = typeof date === "string" ? new Date(date) : date;
        const duration = { [unit]: amount } as { days?: number; weeks?: number; months?: number; years?: number; hours?: number; minutes?: number; seconds?: number };
        return dateFnsAdd(d, duration);
    }
    minus(date: Date | string, amount: number, unit: DateUnit): Date {
        const d = typeof date === "string" ? new Date(date) : date;
        const duration = { [unit]: amount } as { days?: number; weeks?: number; months?: number; years?: number; hours?: number; minutes?: number; seconds?: number };
        return dateFnsSub(d, duration);
    }
}

export const zodulaDate = new ZodulaDate();

export function formatTimeAgo(dateString: string): string {
    const date = parseDate(dateString);
    if (!date) return "-";
    return formatDistanceToNow(date);
}

export function addDays(date: Date | string, days: number): Date {
    const d = typeof date === "string" ? new Date(date) : date;
    return dateFnsAddDays(d, days);
}

export function minusDays(date: Date | string, days: number): Date {
    const d = typeof date === "string" ? new Date(date) : date;
    return subDays(d, days);
}
