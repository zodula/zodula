import { useEffect, useMemo, useState } from "react";
import { useDocListAll } from "../../hooks/use-doc-list-all";
import { Button } from "../ui/button";
import { cn } from "@/zodula/ui/lib/utils";
import { ClientFieldHelper } from "@/zodula/client/field";

export type CSVExportOption = { key: string; label: string };

interface CSVDialogProps {
    isOpen: boolean;
    onClose: (result?: { fields: string[]; labels: string[] }) => void;
    initialData?: { doctype: string; selected: string[] };
}

export const CSVDialog = ({ isOpen, onClose, initialData }: CSVDialogProps) => {
    const doctype = initialData?.doctype as Zodula.DoctypeName | undefined;
    const { docs: allFields } = useDocListAll({
        doctype: "Field",
    });

    const exportOptions: CSVExportOption[] = useMemo(() => {
        if (!doctype || !allFields?.length) return [];
        const parentRows = allFields
            .filter(
                (f: any) =>
                    f.doctype === doctype &&
                    !ClientFieldHelper.isLayoutField(f)
            )
            .sort((a: any, b: any) => (a.idx || 0) - (b.idx || 0));

        const out: CSVExportOption[] = [];
        for (const f of parentRows) {
            const field = f as Zodula.Field;
            if (field.type === "Reference Table" && field.reference) {
                const childRows = allFields.filter(
                    (cf: any) =>
                        cf.doctype === field.reference &&
                        !ClientFieldHelper.isLayoutField(cf)
                );
                for (const cf of childRows) {
                    const c = cf as Zodula.Field;
                    out.push({
                        key: `${field.name}.${c.name}`,
                        label: `${field.label || field.name} > ${c.label || c.name}`,
                    });
                }
            } else if (field.type !== "Extend") {
                out.push({
                    key: field.name || "",
                    label: field.label || field.name || "",
                });
            }
        }
        return out;
    }, [allFields, doctype]);

    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

    const optionKeysSig = useMemo(
        () => exportOptions.map((o) => o.key).join("\0"),
        [exportOptions]
    );

    useEffect(() => {
        if (exportOptions.length === 0) {
            setSelectedKeys([]);
            return;
        }
        const hasId = exportOptions.some((o) => o.key === "id");
        setSelectedKeys(hasId ? ["id"] : []);
    }, [optionKeysSig]);

    const toggle = (key: string) => {
        setSelectedKeys((prev) =>
            prev.includes(key)
                ? prev.filter((k) => k !== key)
                : [...prev, key]
        );
    };

    const allSelected =
        exportOptions.length > 0 &&
        selectedKeys.length === exportOptions.length;

    return (
        <div className="zd:min-w-[500px] zd:flex zd:flex-col zd:gap-2">
            <div className="zd:flex zd:items-center zd:justify-between zd:gap-2 zd:mt-2">
                <span className="zd:text-sm">
                    Select fields to export (order = CSV columns)
                </span>
                <button
                    type="button"
                    className="zd:shrink-0 zd:text-sm zd:text-muted-foreground hover:zd:text-foreground zd:underline zd:underline-offset-2"
                    onClick={() =>
                        allSelected
                            ? setSelectedKeys([])
                            : setSelectedKeys(exportOptions.map((o) => o.key))
                    }
                >
                    {allSelected ? "Clear all" : "Select all"}
                </button>
            </div>
            <div className="zd:max-h-[min(60vh,480px)] zd:overflow-y-auto zd:border zd:rounded-md zd:p-2 zd:space-y-1">
                {exportOptions.map((opt) => {
                    const isSelected = selectedKeys.includes(opt.key);
                    const idx = isSelected
                        ? selectedKeys.indexOf(opt.key) + 1
                        : 0;
                    return (
                        <div
                            key={opt.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggle(opt.key)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && toggle(opt.key)
                            }
                            className="zd:flex zd:min-w-0 zd:cursor-pointer zd:items-center zd:gap-2 zd:rounded zd:py-0.5 zd:text-sm hover:zd:bg-muted/50"
                        >
                            <div
                                className={cn(
                                    "zd:flex zd:h-5 zd:w-5 zd:shrink-0 zd:items-center zd:justify-center zd:rounded-full zd:border zd:border-input",
                                    isSelected
                                        ? "zd:bg-primary zd:text-primary-foreground"
                                        : "zd:bg-background zd:text-muted-foreground"
                                )}
                            >
                                <span className="zd:text-xs zd:font-medium">
                                    {idx || ""}
                                </span>
                            </div>
                            <span className="zd:truncate" title={opt.label}>
                                {opt.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="zd:flex zd:items-center zd:space-x-2 zd:justify-end">
                <Button onClick={() => onClose()} variant="subtle">
                    Close
                </Button>
                <Button
                    onClick={() => {
                        const labels = selectedKeys.map(
                            (k) =>
                                exportOptions.find((o) => o.key === k)?.label || k
                        );
                        onClose({ fields: selectedKeys, labels });
                    }}
                    variant="solid"
                    disabled={selectedKeys.length === 0}
                >
                    Export
                </Button>
            </div>
        </div>
    );
};
