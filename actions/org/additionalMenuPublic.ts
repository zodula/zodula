/** Public name card: only rows with both label and url. */
export function normalizeOrgAdditionalMenu(raw: unknown): { label: string; url: string }[] {
    if (!Array.isArray(raw)) return [];
    const out: { label: string; url: string }[] = [];
    for (const row of raw) {
        const label = String((row as { label?: string })?.label ?? "").trim();
        const url = String((row as { url?: string })?.url ?? "").trim();
        if (label && url) out.push({ label, url });
    }
    return out;
}
