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

export default $action(
    async (ctx) => {
        const { columns, rows, filename } = ctx.body;
        const hasRoles = await $zodula.session.hasRoles([
            "System Admin",
            "Authenticated",
        ]);
        if (!hasRoles) {
            return ctx.json({ data: [] }, 403);
        }

        const keys = columns.map((c: { key: string }) => c.key);
        const headerRow = columns.map((c: { key: string; label: string }) =>
            csvEscape(c.label ?? c.key)
        );
        const lines: string[] = [headerRow.join(",")];

        for (const row of rows as Record<string, unknown>[]) {
            const line = keys
                .map((k) => csvEscape(row?.[k as keyof typeof row]))
                .join(",");
            lines.push(line);
        }

        const safeName = String(filename || "export").replace(/[^\w.-]+/g, "_");
        return new Response(lines.join("\n"), {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${safeName}.csv"`,
            },
        });
    },
    {
        body: z.object({
            columns: z.array(
                z.object({
                    key: z.string(),
                    label: z.string(),
                })
            ),
            rows: z.array(z.record(z.string(), z.any())),
            filename: z.string().optional(),
        }),
    }
);
