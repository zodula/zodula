import { ClientFieldHelper } from "@/zodula/client/field";

/** Value for a sheet column: plain field or dotted `parent.child` (joined child row values). Used for filters / export. */
export function getSheetCellValue(doc: any, columnKey: string): unknown {
    if (doc == null) return undefined;
    if (!columnKey.includes(".")) {
        return doc[columnKey];
    }
    const i = columnKey.indexOf(".");
    const parent = columnKey.slice(0, i);
    const child = columnKey.slice(i + 1);
    const arr = doc[parent];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const parts = arr
        .map((row: any) => row?.[child])
        .filter((v: unknown) => v != null && v !== "");
    if (parts.length === 0) return null;
    return parts.map((v: unknown) => String(v)).join(", ");
}

/** Max child-table rows needed for staggered display (any visible `parent.child` column). */
export function maxChildRowsForDoc(doc: any, columnKeys: string[]): number {
    let max = 0;
    for (const key of columnKeys) {
        if (!key.includes(".")) continue;
        const parent = key.slice(0, key.indexOf("."));
        const arr = doc?.[parent];
        const len = Array.isArray(arr) ? arr.length : 0;
        if (len > max) max = len;
    }
    return max;
}

/**
 * Sheet grid cell: parent row = parent fields only; child rows = one index per row for dotted columns only.
 * `stagger` `none` = single row (aggregated or no child columns).
 */
export function getStaggeredSheetCellValue(
    doc: any,
    columnKey: string,
    stagger: "none" | "parent" | "child",
    childIndex?: number
): unknown {
    if (doc == null) return undefined;
    if (stagger === "none") {
        return getSheetCellValue(doc, columnKey);
    }
    const dotted = columnKey.includes(".");
    if (stagger === "parent") {
        if (dotted) return null;
        return doc[columnKey];
    }
    if (stagger === "child") {
        if (!dotted) return null;
        const parsed = parseDottedFieldPath(columnKey);
        if (!parsed || childIndex === undefined) return null;
        const arr = doc[parsed.parent];
        const row = Array.isArray(arr) ? arr[childIndex] : undefined;
        return row?.[parsed.child];
    }
    return undefined;
}

export function parseDottedFieldPath(
    field: string
): { parent: string; child: string } | null {
    const i = field.indexOf(".");
    if (i <= 0) return null;
    const parent = field.slice(0, i);
    const child = field.slice(i + 1);
    if (!parent || !child) return null;
    return { parent, child };
}

/** Whether `key` is a valid visible column (parent field name or parent.child on a Reference Table). */
export function isSheetColumnKeyValid(
    key: string,
    parentFields: any[],
    allFieldRows: any[]
): boolean {
    if (parentFields.some((f) => f.name === key)) return true;
    const parsed = parseDottedFieldPath(key);
    if (!parsed) return false;
    const pf = parentFields.find((f) => f.name === parsed.parent);
    if (!pf || pf.type !== "Reference Table" || !pf.reference) return false;
    return allFieldRows.some(
        (cf: any) =>
            cf.doctype === pf.reference &&
            cf.name === parsed.child &&
            !ClientFieldHelper.isLayoutField(cf)
    );
}

export function labelForSheetColumnKey(
    key: string,
    parentFields: any[],
    allFieldRows: any[]
): string {
    const pf = parentFields.find((f) => f.name === key);
    if (pf) return pf.label || key;
    const parsed = parseDottedFieldPath(key);
    if (!parsed) return key;
    const parentF = parentFields.find((f) => f.name === parsed.parent);
    const childF = allFieldRows.find(
        (cf: any) =>
            cf.doctype === parentF?.reference && cf.name === parsed.child
    );
    return `${parentF?.label || parsed.parent} > ${childF?.label || parsed.child}`;
}
