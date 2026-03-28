import type { IFilter, IOperator } from "@/zodula/server/zodula/type";

/** Sheet header column filters (same shape as SheetView column filter row state). */
export type SheetColumnFilterState = Record<
    string,
    { operator: IOperator; value: string }
>;

/**
 * Converts sheet header filters to `IFilter` tuples for `report.get` / select `.where`.
 * Value coercion matches {@link FilterContent} `buildValidFilters`.
 */
export function sheetColumnFiltersToIFilters(
    state: SheetColumnFilterState
): IFilter<any, any, IOperator>[] {
    const floatRegex = /^[0-9]+\.?[0-9]*$/;
    const intRegex = /^[0-9]+$/;
    const out: IFilter<any, any, IOperator>[] = [];

    for (const [field, row] of Object.entries(state)) {
        if (!field || !row?.operator) continue;
        if (
            !["IS NULL", "IS NOT NULL"].includes(row.operator) &&
            String(row.value ?? "").trim() === ""
        ) {
            continue;
        }

        let value: any = row.value;
        if (["IN", "NOT IN"].includes(row.operator)) {
            value = String(row.value ?? "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
            if (value.length === 0) continue;
        } else if (["IS NULL", "IS NOT NULL"].includes(row.operator)) {
            value = "1";
        } else if (row.operator === "LIKE" || row.operator === "NOT LIKE") {
            value = row.value;
        } else {
            const raw = String(row.value ?? "");
            value = floatRegex.test(raw)
                ? parseFloat(raw)
                : intRegex.test(raw)
                  ? parseInt(raw, 10)
                  : row.value;
        }

        out.push([field as any, row.operator, value]);
    }

    return out;
}
