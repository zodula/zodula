import React, { useMemo, useState } from "react";
import { FormPlugin } from "../plugin";
import { Pencil, PlusIcon, GripVertical, X, ArrowUpDown, Info } from "lucide-react";
import { Tooltip } from "../../ui/tooltip";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select } from "../../ui/select";
import { FormControl } from "../../ui/form-control";
import { Dialog, DialogContent, DialogTitle } from "../../ui/dialog";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useDnd } from "../../../hooks/use-dnd";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

// Inline field editor component for table cells with client scripts
const InlineFieldEditor = ({ field, value, onChange, formData, docId, readonly, doctype, onRowUpdate, fieldPath, referenceTableFields, extendFields, referenceTableIndexFields }: {
    field: any;
    value: any;
    onChange: (fieldPath: string, value: any) => void;
    formData?: any;
    docId: string;
    readonly?: boolean;
    doctype?: string;
    onRowUpdate?: (fieldName: string, newValue: any) => void;
    fieldPath?: string; // The nested field path (e.g., "invoice_items.0.account")
    referenceTableFields?: Record<string, any>;
    extendFields?: Record<string, any>;
    referenceTableIndexFields?: Record<string, { idx: number, fields: Zodula.SelectDoctype<"Field">[] }[]>;
}) => {
    // Get doc_status from parent document (formData contains parent form data)
    const docStatus = formData?.doc_status ?? "Draft";

    // Check doc_status based readonly conditions for this field
    let statusBasedReadonly = false;

    // Access field config properties (allow_on_submit and only_once are direct properties on field)
    // Support both field.config.allow_on_submit (if config exists) and field.allow_on_submit (direct property)
    const allowOnSubmit = (field as any).config?.allow_on_submit ?? field.allow_on_submit;
    const onlyOnce = (field as any).config?.only_once ?? field.only_once;

    // Condition 1: doc_status == 1 && field.config.allow_on_submit !== 1
    if (docStatus === "Submitted" && allowOnSubmit !== 1) {
        statusBasedReadonly = true;
    }
    // Condition 2: doc_status == 0 && field.config.only_once == 1
    else if (docStatus === "Draft" && onlyOnce === 1) {
        statusBasedReadonly = true;
    }
    // Condition 3: doc_status !== 1 && doc_status !== 0
    else if (docStatus !== "Submitted" && docStatus !== "Draft") {
        statusBasedReadonly = true;
    }


    // Combine field readonly with status-based readonly
    const fieldReadonly = readonly || field.readonly === 1;

    // Get overrides for this specific row index
    // First check for row-specific overrides, then fall back to "all rows" overrides (-1)
    const handleFieldChange = (fieldName: string, newValue: any) => {
        // Call the parent onChange
        onChange(fieldPath || "", newValue);
    };

    return (
        <>
            <FormControl
                showDescription={false}
                docId={docId}
                field={field}
                fieldKey={fieldPath || field.name}
                value={value}
                onChange={handleFieldChange}
                hideFormControl={true}
                formData={formData}
                required={field.required === 1}
                readonly={fieldReadonly}
                fieldPath={fieldPath}
                referenceTableFields={referenceTableFields}
                extendFields={extendFields}
            />
        </>
    );
};

export const ReferenceTablePlugin = new FormPlugin({
    types: ["Reference Table"],
    render: (props) => {
        // Get fields for the reference doctype
        const fields = props.referenceTableFields?.[props.fieldKey || ""] ?? [];

        const { t } = useTranslation()

        // Use props.value directly for table data
        const tableData = useMemo(() => {
            if (!props.value || !Array.isArray(props.value)) return [];
            return props.value?.sort((a: any, b: any) => a.idx - b.idx);
        }, [props.value]);

        const handleAddRow = async () => {
            if (props.readonly) return;
            const fieldPartialPath = `${props.fieldKey}.${tableData.length}`;
            props.onChange?.(`${fieldPartialPath}.id`, `temp_${Date.now()}`);
        };

        const handleRemoveRow = (index: number) => {
            if (props.readonly) return;
            const fieldPartialPath = `${props.fieldKey}.${index}`;
            props.onChange?.(`${fieldPartialPath}.idx`, -1);
        };

        // Handler for updating any field in a row (used by child scripts)
        const handleRowFieldUpdate = (rowIndex: number, fieldName: string, value: any) => {
            if (props.readonly) return;
            const newTableData = [...tableData];
            newTableData[rowIndex] = {
                ...newTableData[rowIndex],
                [fieldName]: value
            };
            props.onChange?.(props.fieldPath || "", newTableData);
        };

        const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
        const editFields = fields.filter(
            (f: Zodula.Field) =>
                f.doctype === props.fieldOptions.reference &&
                !ClientFieldHelper.isStandardField(f.name as string) &&
                f.name !== "idx"
        ) as Zodula.Field[];

        const handleEditRow = (index: number) => {
            setEditingRowIndex(index);
        };

        const handleCloseEditRow = () => {
            setEditingRowIndex(null);
        };

        const handleReorder = (fromId: string, toId: string, type: 'before' | 'after') => {
            if (props.readonly) return;

            const fromIndex = parseInt(fromId.replace('row_', ''));
            const toIndex = parseInt(toId.replace('row_', ''));

            if (fromIndex < 0 || toIndex < 0 || fromIndex >= tableData.length || toIndex >= tableData.length) return;

            const newTableData = [...tableData];
            const itemToMove = newTableData[fromIndex];

            // Remove the item from its current position
            newTableData.splice(fromIndex, 1);

            // Calculate the new insertion index
            let newInsertIndex = toIndex;
            if (fromIndex < toIndex) {
                newInsertIndex = toIndex - 1;
            }

            if (type === 'after') {
                newInsertIndex += 1;
            }

            // Insert the item at the new position
            newTableData.splice(newInsertIndex, 0, itemToMove);

            // Update idx values
            const reorderedData = newTableData.map((item, index) => ({
                ...item,
                idx: index
            }));

            props.onChange?.(props.fieldPath || "", reorderedData);
        };

        // Create workspace items for drag and drop
        const workspaceItems = tableData?.length > 0 ? tableData.map((row, index) => ({
            id: `row_${index}`,
            type: 'table-row',
            data: row,
            workspaceId: 'reference-table' // Dummy workspace ID for drag and drop
        })) : [];

        // Initialize drag and drop
        const { getDragProps, getDropZoneProps } = useDnd({
            items: workspaceItems,
            onReorder: handleReorder,
            disabled: props.readonly
        });

        // Get display fields for the table columns
        const displayFields = fields.filter((field: Zodula.Field) =>
            field.doctype === props.fieldOptions.reference &&
            (field.in_list_view === 1 || field.required === 1) &&
            !ClientFieldHelper.isStandardField(field.name as string) &&
            field.name !== 'idx' // Hide idx field as it's handled separately
        ) as Zodula.Field[];

        const [sortField, setSortField] = useState<string | null>(null);
        const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
        const [sortOpen, setSortOpen] = useState(false);

        const handleApplySort = () => {
            if (!sortField || tableData.length === 0) return;
            const cmp = (a: any, b: any) => {
                const va = a?.[sortField];
                const vb = b?.[sortField];
                const empty = (v: any) => v === undefined || v === null || v === "";
                if (empty(va) && empty(vb)) return 0;
                if (empty(va)) return sortOrder === "asc" ? 1 : -1;
                if (empty(vb)) return sortOrder === "asc" ? -1 : 1;
                if (typeof va === "number" && typeof vb === "number") return sortOrder === "asc" ? va - vb : vb - va;
                const sa = String(va);
                const sb = String(vb);
                const r = sa.localeCompare(sb, undefined, { numeric: true });
                return sortOrder === "asc" ? r : -r;
            };
            const sorted = [...tableData].sort(cmp);
            const withIdx = sorted.map((row, i) => ({ ...row, idx: i }));
            props.onChange?.(props.fieldPath || "", withIdx);
            setSortOpen(false);
        };

        return (
            <div className="zd:space-y-2">

                {/* Table */}
                <div className="zd:border zd:rounded-lg zd:overflow-x-auto">
                    <table className="zd:w-full zd:text-sm">
                        <thead className="zd:bg-muted/50 zd:whitespace-nowrap">
                            <tr>
                                <th className="zd:px-2 zd:py-2 zd:font-medium zd:text-left zd:w-8 no-print"></th>
                                <th className="zd:px-2 zd:py-2 zd:font-medium zd:text-left zd:w-8">#</th>
                                {/* <th className="zd:px-2 zd:py-2 zd:font-medium zd:text-left no-print">
                                {idField.label}
                            </th> */}
                                {displayFields.map((field) => (
                                    <th key={field.name} className="zd:px-2 zd:py-2 zd:font-medium zd:text-left">
                                        <span className="zd:flex zd:items-center zd:gap-1">
                                            {t(field.label || field.name as string)}
                                            {field.required === 1 && <span className="zd:text-red-500 zd:ml-0.5 no-print">*</span>}
                                            {field.description && (
                                                <Tooltip content={field.description} side="top" align="start">
                                                    <span className="zd:inline-flex zd:items-center zd:text-muted-foreground zd:cursor-help no-print">
                                                        <Info className="zd:h-3.5 zd:w-3.5" />
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </span>
                                    </th>
                                ))}
                                <th className="zd:px-2 zd:py-2 zd:font-medium zd:text-right zd:w-20  no-print"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={displayFields.length + 4}
                                        className="zd:px-3 zd:py-6 zd:text-center zd:text-muted-foreground no-print"
                                    >
                                        {t("No Row")}
                                    </td>
                                </tr>
                            ) : (
                                tableData.map((row, index) => {
                                    const workspaceItem = workspaceItems[index];
                                    if (!workspaceItem) return null;
                                    const dragProps = getDragProps(workspaceItem, index);
                                    const dropZoneProps = getDropZoneProps(index, workspaceItem);

                                    return (
                                        <tr
                                            key={row.id || index}
                                            className={`zd:hover:bg-muted/30 ${dropZoneProps.className}`}
                                            onDragOver={dropZoneProps.onDragOver}
                                            onDragLeave={dropZoneProps.onDragLeave}
                                            onDrop={dropZoneProps.onDrop}
                                            data-drop-index={dropZoneProps['data-drop-index']}
                                        >
                                            <td className="zd:p-0.5  no-print">
                                                {!props.readonly && (
                                                    <div
                                                        draggable={dragProps.draggable}
                                                        onDragStart={dragProps.onDragStart}
                                                        onDragEnd={dragProps.onDragEnd}
                                                        data-drag-id={dragProps['data-drag-id']}
                                                        className="zd:cursor-grab zd:active:cursor-grabbing zd:p-1 zd:hover:bg-muted/50 zd:rounded"
                                                    >
                                                        <GripVertical className="zd:w-4 zd:h-4 zd:text-muted-foreground" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="zd:p-0.5">{row.idx + 1}</td>
                                            {/* <td className="zd:px-2 zd:py-2 no-print">
                                            <FormControl
                                                field={idField}
                                                fieldKey="id"
                                                readonly={true}
                                                value={row.id}
                                                onChange={(fieldName, newValue) => handleFieldChange(index, 'id', newValue)}
                                                hideFormControl={true}
                                                className="zd:h-8 no-print"
                                            />
                                        </td> */}
                                            {displayFields.map((field) => {
                                                const setPropertyFields = props.referenceTableIndexFields?.[props?.fieldKey || ""]?.find((record: any) => record.idx === index && record.fields.find((f: any) => f.name === field.name) !== undefined);
                                                const setPropertyField = setPropertyFields?.fields[0];
                                                const mergeField = { ...field, ...setPropertyField };
                                                return (
                                                    <td key={field.name} className="zd:p-0.5">
                                                        <InlineFieldEditor
                                                            docId={props.docId}
                                                            field={mergeField}
                                                            value={row[field.name as string]}
                                                            onChange={(fieldPath: string, value: any) => props.onChange?.(fieldPath, value)}
                                                            formData={{ ...props.formData, ...row }} // Merge parent and row data so dynamic references can resolve from row fields first, then parent fields
                                                            readonly={field.readonly === 1 || props.readonly}
                                                            doctype={props.fieldOptions.doctype as string}
                                                            onRowUpdate={(fieldName, newValue) => handleRowFieldUpdate(index, fieldName, newValue)}
                                                            fieldPath={`${props.fieldKey}.${index}.${field.name}`} // Pass the nested field path
                                                            referenceTableFields={props.referenceTableFields}
                                                            extendFields={props.extendFields}
                                                        />
                                                    </td>
                                                )
                                            })}
                                            <td className="no-print zd:sticky zd:right-0">
                                                <div className="zd:h-full zd:flex zd:items-center zd:justify-end zd:gap-1 zd:bg-muted zd:rounded-lg zd:border zd:w-fit">
                                                    <Button
                                                        hideLoading
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditRow(index)}
                                                    >
                                                        <Pencil />
                                                    </Button>
                                                    {!props.readonly && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveRow(index)}
                                                        >
                                                            <X className="zd:w-4 zd:h-4 zd:text-destructive zd:hover:text-destructive" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Action bar */}
                <div className="zd:flex zd:items-center zd:justify-between">
                    <div className="zd:flex zd:items-center zd:gap-2">
                        {!props.readonly && (
                            <Button
                                onClick={handleAddRow}
                                variant={"subtle"}
                                size="sm"
                            >
                                <PlusIcon className="zd:w-4" />
                                {t("Add Row")}
                            </Button>
                        )}
                        {tableData.length > 0 && (
                            <Popover open={sortOpen} onOpenChange={setSortOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="subtle" size="sm">
                                        <ArrowUpDown className="zd:w-4" />
                                        {t("Sort")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="zd:w-64 zd:p-3 zd:space-y-3" align="start">
                                    <div className="zd:space-y-2">
                                        <label className="zd:text-sm zd:font-medium">{t("Sort by")}</label>
                                        <Select
                                            displayMode="label"
                                            options={[
                                                { value: "", label: t("Select field") },
                                                ...displayFields.map((f: Zodula.Field) => ({ value: f.name as string, label: t(f.label || f.name as string) })),
                                            ]}
                                            value={sortField ?? ""}
                                            onChange={(v) => setSortField(v || null)}
                                            className="zd:w-full"
                                        />
                                    </div>
                                    <div className="zd:space-y-2">
                                        <label className="zd:text-sm zd:font-medium">{t("Order")}</label>
                                        <Select
                                            displayMode="label"
                                            options={[
                                                { value: "asc", label: t("Ascending") },
                                                { value: "desc", label: t("Descending") },
                                            ]}
                                            value={sortOrder}
                                            onChange={(v) => setSortOrder((v as "asc" | "desc") || "asc")}
                                            className="zd:w-full"
                                        />
                                    </div>
                                    <Button size="sm" className="zd:w-full" onClick={handleApplySort} disabled={!sortField}>
                                        {t("Apply")}
                                    </Button>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                    <div className="zd:flex zd:items-center zd:gap-2">
                    </div>
                </div>

                {/* Inline edit row dialog – local state while editing so typing is fast; persist on Done */}
                <Dialog open={editingRowIndex !== null} onClose={handleCloseEditRow}>
                    <div className="zd:fixed zd:inset-0 zd:bg-black/40 zd:backdrop-blur-sm" aria-hidden="true" />
                    <div className="zd:fixed zd:inset-0 zd:flex zd:items-center zd:justify-center zd:p-4">
                        <DialogContent className="zd:max-w-[560px] zd:w-full zd:max-h-[90vh] zd:overflow-y-auto zd:mx-auto zd:p-6">
                            <div>
                                <div className="zd:flex zd:items-center zd:justify-between zd:mb-4">
                                    <DialogTitle>{t("Edit Row")}</DialogTitle>
                                    <Button variant="ghost" size="sm" onClick={handleCloseEditRow} className="zd:h-6 zd:w-6 zd:p-0">
                                        <X className="zd:h-4 zd:w-4" />
                                    </Button>
                                </div>
                                {editingRowIndex !== null && editingRowIndex >= 0 && editingRowIndex < tableData.length && (
                                    <div className="zd:space-y-4">
                                    {editFields.map((field) => {
                                        const setPropertyFields = props.referenceTableIndexFields?.[props.fieldKey ?? ""]?.find(
                                            (record: any) =>
                                                record.idx === editingRowIndex &&
                                                record.fields?.find((f: any) => f.name === field.name) !== undefined
                                        );
                                        const setPropertyField = setPropertyFields?.fields?.[0];
                                        const mergeField = { ...field, ...setPropertyField };
                                        const fieldPath = `${props.fieldKey}.${editingRowIndex}.${field.name}`;
                                        const row = tableData[editingRowIndex];
                                        return (
                                            <FormControl
                                                key={field.name}
                                                label={t((mergeField.label || mergeField.name) as string)}
                                                showDescription={true}
                                                docId={props.docId}
                                                field={mergeField}
                                                fieldKey={fieldPath}
                                                value={row?.[field.name as string]}
                                                onChange={(_path, value) => props.onChange?.(fieldPath, value)}
                                                formData={{ ...props.formData, ...row }}
                                                required={field.required === 1}
                                                readonly={field.readonly === 1 || props.readonly}
                                                fieldPath={fieldPath}
                                                referenceTableFields={props.referenceTableFields}
                                                extendFields={props.extendFields}
                                                referenceTableIndexFields={props.referenceTableIndexFields}
                                            />
                                        );
                                    })}
                                    <div className="zd:flex zd:justify-end zd:pt-2">
                                        <Button size="sm" onClick={handleCloseEditRow}>
                                            {t("Done")}
                                        </Button>
                                    </div>
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </div>
                </Dialog>
            </div>
        );
    }
});

