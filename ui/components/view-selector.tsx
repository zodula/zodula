import React from "react";
import { Select } from "./ui/select";

export type ViewOption = {
    value: string;
    label: string;
    disabled?: boolean;
};

export interface ViewSelectorProps {
    views: ViewOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

/** Returns the field name of a self-referential Reference field, or null if none. */
export function findSelfReferentialField(
    fields: { doctype: string; name: string; type: string; reference?: string | null }[],
    doctype: string
): string | null {
    const selfRefField = fields.find(
        (f) =>
            f.doctype === doctype &&
            f.type === "Reference" &&
            (f.reference === doctype || (f.reference?.trim() === doctype))
    );
    return selfRefField?.name ?? null;
}

export type FieldLike = { doctype?: string | null; name?: string; type?: string | null; reference?: string | null };

export function hasSelfReferentialField(fields: FieldLike[], doctype: string): boolean {
    return findSelfReferentialField(
        fields as { doctype: string; name: string; type: string; reference?: string | null }[],
        doctype
    ) != null;
}

/** Build list/tree/sheet view options; tree is disabled when doctype has no self-referential field. */
export function getDoctypeViewOptions(
    t: (key: string) => string,
    fields: FieldLike[],
    doctype: string
): ViewOption[] {
    const treeEnabled = hasSelfReferentialField(fields, doctype);
    return [
        { value: "list", label: t("List View") },
        { value: "tree", label: t("Tree View"), disabled: !treeEnabled },
        { value: "sheet", label: t("Sheet View") },
    ];
}

export function ViewSelector({ views, value, onChange, className }: ViewSelectorProps) {
    return (
        <Select
            options={views}
            displayMode="label"
            value={value}
            onChange={onChange}
            className={className}
        />
    );
}
