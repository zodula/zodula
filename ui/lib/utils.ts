import { twMerge } from "tailwind-merge"
import clsx, { type ClassValue } from "clsx"

export function cn(...classes: string[]) {
    return twMerge(clsx(classes))
}

export function getCookies() {
    return document.cookie.split("; ").reduce((acc, cookie) => {
        const [key, value] = cookie.split("=");
        if (!key || !value) return acc;
        acc[key] = decodeURIComponent(value ?? "");
        return acc;
    }, {} as Record<string, string>);
}

export function getCookie(name: string) {
    return getCookies()[name];
}