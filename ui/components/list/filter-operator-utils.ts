import type { IOperator } from "@/zodula/server/zodula/type";
import { plugins } from "../form/plugins";

/** Operator labels aligned with FilterContent / filter popup. */
export const FILTER_OPERATOR_OPTIONS: { value: IOperator; label: string }[] = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not Equals" },
  { value: ">", label: "Greater Than" },
  { value: ">=", label: "Greater Than or Equal" },
  { value: "<", label: "Less Than" },
  { value: "<=", label: "Less Than or Equal" },
  { value: "LIKE", label: "Like" },
  { value: "NOT LIKE", label: "Not Like" },
  { value: "IN", label: "In" },
  { value: "NOT IN", label: "Not In" },
  { value: "IS NULL", label: "Is Null" },
  { value: "IS NOT NULL", label: "Is Not Null" },
];

const COUNT_OPERATORS = FILTER_OPERATOR_OPTIONS.filter((op) =>
  ["=", "!=", ">", ">=", "<", "<="].includes(op.value)
);

function isReferenceTableCountColumn(
  fields: Zodula.Field[],
  columnKey: string
): boolean {
  return fields.some(
    (f) => f.name === columnKey && f.type === "Reference Table"
  );
}

/** Resolve field metadata for a sheet column (plain name or `parent.child` child column). */
export function getFieldForSheetColumn(
  fields: Zodula.Field[],
  columnKey: string,
  allFields?: Zodula.Field[] | null
): Zodula.Field | undefined {
  const direct = fields.find((f) => f.name === columnKey);
  if (direct) return direct;
  if (!allFields?.length || !columnKey.includes(".")) return undefined;
  const i = columnKey.indexOf(".");
  const parent = columnKey.slice(0, i);
  const child = columnKey.slice(i + 1);
  const pf = fields.find((f) => f.name === parent);
  if (!pf || pf.type !== "Reference Table" || !pf.reference) return undefined;
  return allFields.find(
    (f) => f.doctype === pf.reference && f.name === child
  ) as Zodula.Field | undefined;
}

/** Operators allowed for a sheet column, from the field's FormPlugin.supportOperators (same idea as FilterContent). */
export function getSupportedOperatorOptionsForSheetColumn(
  fields: Zodula.Field[],
  columnKey: string,
  allFields?: Zodula.Field[] | null
): { value: IOperator; label: string }[] {
  if (columnKey === "_count") {
    return COUNT_OPERATORS;
  }
  if (isReferenceTableCountColumn(fields, columnKey)) {
    return COUNT_OPERATORS;
  }
  const field =
    getFieldForSheetColumn(fields, columnKey, allFields) ||
    fields.find((f) => f.name === columnKey);
  if (!field) {
    return FILTER_OPERATOR_OPTIONS;
  }
  const plugin = plugins.find((p) => p.types.includes(field.type as any));
  if (plugin?.supportOperators?.length) {
    return FILTER_OPERATOR_OPTIONS.filter((op) =>
      plugin.supportOperators!.includes(op.value)
    );
  }
  return FILTER_OPERATOR_OPTIONS;
}

export function defaultOperatorForSheetColumn(
  fields: Zodula.Field[],
  columnKey: string,
  allFields?: Zodula.Field[] | null
): IOperator {
  const opts = getSupportedOperatorOptionsForSheetColumn(
    fields,
    columnKey,
    allFields
  );
  return opts[0]?.value ?? "=";
}

export function resolveSheetColumnOperator(
  fields: Zodula.Field[],
  columnKey: string,
  stored: IOperator | undefined,
  allFields?: Zodula.Field[] | null
): IOperator {
  const allowed = getSupportedOperatorOptionsForSheetColumn(
    fields,
    columnKey,
    allFields
  ).map((o) => o.value);
  if (stored && allowed.includes(stored)) {
    return stored;
  }
  return allowed[0] ?? "=";
}

function isEffectivelyEmpty(cellValue: unknown): boolean {
  return cellValue === null || cellValue === undefined || cellValue === "";
}

function sqlLikeMatch(target: string, pattern: string): boolean {
  if (!pattern.includes("%") && !pattern.includes("_")) {
    return target.toLowerCase().includes(pattern.toLowerCase());
  }
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(target);
}

function equalsLoose(cellValue: unknown, rawInput: string): boolean {
  const inputNorm = String(rawInput ?? "").trim();
  const targetStr = cellValue == null ? "" : String(cellValue);
  const targetNorm = targetStr.trim();
  const ti = parseFloat(targetNorm);
  const ii = parseFloat(inputNorm);
  if (
    !Number.isNaN(ti) &&
    !Number.isNaN(ii) &&
    /^-?\d+(\.\d+)?$/.test(inputNorm)
  ) {
    return ti === ii;
  }
  return targetNorm.toLowerCase() === inputNorm.toLowerCase();
}

/** Client-side match for sheet header filters (approximates server filter semantics). */
export function columnFilterMatchesCell(
  cellValue: unknown,
  operator: IOperator,
  rawInput: string
): boolean {
  const input = String(rawInput ?? "").trim();

  switch (operator) {
    case "IS NULL":
      return isEffectivelyEmpty(cellValue);
    case "IS NOT NULL":
      return !isEffectivelyEmpty(cellValue);
    default:
      break;
  }

  if (!input) {
    return true;
  }

  const targetStr = cellValue == null ? "" : String(cellValue);
  const targetNorm = targetStr.trim();

  switch (operator) {
    case "=":
      return equalsLoose(cellValue, rawInput);
    case "!=":
      return !equalsLoose(cellValue, rawInput);
    case ">":
    case ">=":
    case "<":
    case "<=": {
      const ti = parseFloat(String(cellValue));
      const ii = parseFloat(input);
      if (Number.isNaN(ti) || Number.isNaN(ii)) return false;
      if (operator === ">") return ti > ii;
      if (operator === ">=") return ti >= ii;
      if (operator === "<") return ti < ii;
      return ti <= ii;
    }
    case "LIKE":
      return sqlLikeMatch(targetNorm, input);
    case "NOT LIKE":
      return !sqlLikeMatch(targetNorm, input);
    case "IN": {
      const parts = input
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return parts.some((p) => targetNorm.toLowerCase() === p);
    }
    case "NOT IN": {
      const parts = input
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return !parts.some((p) => targetNorm.toLowerCase() === p);
    }
    default:
      return true;
  }
}
