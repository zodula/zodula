import { z } from "bxo";

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        try {
            return csvEscape(JSON.stringify(value));
        } catch {
            return csvEscape(String(value));
        }
    }
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function parseChildFieldPath(
    field: string
): { parent: string; child: string } | null {
    const i = field.indexOf(".");
    if (i <= 0) return null;
    const parent = field.slice(0, i);
    const child = field.slice(i + 1);
    if (!parent || !child) return null;
    return { parent, child };
}

export default $action(
    async (ctx) => {
        const { doctype, ids, fields: rawFields, headers } = ctx.body;
        const hasRoles = await $zodula.session.hasRoles([
            "System Admin",
            "Authenticated",
        ]);
        if (!hasRoles) {
            return ctx.json(
                {
                    data: [],
                },
                403
            );
        }

        let exportFields = [...rawFields];
        if (!exportFields.includes("id")) {
            exportFields = ["id", ...exportFields];
        }

        let labelRow: string[];
        if (headers && headers.length === rawFields.length && !rawFields.includes("id")) {
            labelRow = ["id", ...headers];
        } else if (headers && headers.length === exportFields.length) {
            labelRow = [...headers];
        } else {
            labelRow = [...exportFields];
        }

        const keyRow = [...exportFields];

        const parentFieldNames = [
            ...new Set(exportFields.filter((f) => !f.includes("."))),
        ];
        const dottedFields = exportFields.filter((f) => f.includes("."));

        const selectFieldsList =
            parentFieldNames.length > 0 ? parentFieldNames : (["id"] as string[]);

        const result = await $zodula
            .doctype(doctype as any)
            .select()
            .where("id", "IN", ids)
            .bypass(true)
            .fields(selectFieldsList as any);

        const docsById = new Map(
            (result.docs as any[]).map((d) => [d.id as string, d])
        );
        const orderedDocs = ids
            .map((id) => docsById.get(id))
            .filter(Boolean) as any[];

        const lines: string[] = [];
        lines.push(labelRow.map(csvEscape).join(","));
        lines.push(keyRow.map(csvEscape).join(","));

        const parentsWithChildCols = new Set(
            dottedFields
                .map((spec) => parseChildFieldPath(spec)?.parent)
                .filter(Boolean) as string[]
        );

        const hasChildCols = dottedFields.length > 0;

        for (const doc of orderedDocs) {
            if (!hasChildCols) {
                const row = exportFields.map((field) =>
                    !field.includes(".")
                        ? csvEscape(doc[field])
                        : ""
                );
                lines.push(row.join(","));
                continue;
            }

            // Parent row: fill parent columns; child (dotted) columns empty
            const parentRow = exportFields.map((field) =>
                !field.includes(".")
                    ? csvEscape(doc[field])
                    : ""
            );
            lines.push(parentRow.join(","));

            let maxChildRows = 0;
            for (const p of parentsWithChildCols) {
                const arr = doc[p];
                const len = Array.isArray(arr) ? arr.length : 0;
                if (len > maxChildRows) maxChildRows = len;
            }

            for (let i = 0; i < maxChildRows; i++) {
                const childRow = exportFields.map((field) => {
                    if (!field.includes(".")) {
                        return "";
                    }
                    const parsed = parseChildFieldPath(field);
                    if (!parsed) return "";
                    const { parent, child } = parsed;
                    const arr = doc[parent];
                    const childDoc = Array.isArray(arr) ? arr[i] : undefined;
                    return csvEscape(
                        childDoc ? (childDoc as any)[child] : undefined
                    );
                });
                lines.push(childRow.join(","));
            }
        }

        return new Response(lines.join("\n"), {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${doctype}.csv"`,
            },
        });
    },
    {
        body: z.object({
            doctype: z.string(),
            ids: z.array(z.string()),
            fields: z.array(z.string()),
            headers: z.array(z.string()).optional(),
        }),
    }
);
