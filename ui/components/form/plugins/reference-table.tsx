import React, { useEffect, useMemo, useRef } from "react";
import { FormPlugin } from "../plugin";
import { Pencil, PlusIcon, GripVertical, X } from "lucide-react";
import { Button } from "../../ui/button";
import { FormControl } from "../../ui/form-control";
import { Form } from "../form";
import { useDocList } from "../../../hooks/use-doc-list";
import { useDoc } from "../../../hooks/use-doc";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useForm } from "../../../hooks/use-form";
import { useDnd } from "../../../hooks/use-dnd";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";

// Inline field editor component for table cells with client scripts
const InlineFieldEditor = ({ field, value, onChange, formData, docId, readonly, doctype, onRowUpdate, fieldPath }: {
    field: any;
    value: any;
    onChange: (value: any) => void;
    formData?: any;
    docId: string;
    readonly?: boolean;
    doctype?: string;
    onRowUpdate?: (fieldName: string, newValue: any) => void;
    fieldPath?: string; // The nested field path (e.g., "invoice_items.0.account")
}) => {

    const handleFieldChange = (fieldName: string, newValue: any) => {
        // Call the parent onChange
        onChange(newValue);
    };

    return (
        <FormControl
            docId={docId}
            field={field}
            fieldKey={field.name}
            value={value}
            onChange={handleFieldChange}
            hideFormControl={true}
            className="zd:h-8"
            formData={formData}
            required={field.required === 1}
            readonly={readonly}
            fieldPath={fieldPath}
        />
    );
};

export const ReferenceTablePlugin = new FormPlugin(["Reference Table"], (props) => {
    const { doc: doctypeDoc } = useDoc({
        doctype: "zodula__Doctype",
        id: props.fieldOptions.reference as any
    }, [props.fieldOptions.reference]);

    // Get fields for the reference doctype
    const { docs: fields } = useDocList({
        doctype: "zodula__Field",
        limit: 1000000,
        sort: "idx",
        order: "asc",
        filters: [["doctype", "=", doctypeDoc?.id]]
    }, [doctypeDoc]);

    const { t } = useTranslation()

    // Use props.value directly for table data
    const tableData = useMemo(() => {
        if (!props.value || !Array.isArray(props.value)) return [];
        return props.value;
    }, [props.value]);

    const handleAddRow = () => {
        if (props.readonly) return;
        const newRow = {
            id: `temp_${Date.now()}`,
            idx: tableData.length
        };
        const newTableData = [...tableData, newRow];
        props.onChange?.(newTableData);
    };

    const handleRemoveRow = (index: number) => {
        if (props.readonly) return;
        const newTableData = tableData.filter((_, i) => i !== index);
        props.onChange?.(newTableData);
    };

    const handleFieldChange = (rowIndex: number, fieldName: string, value: any) => {
        if (props.readonly) return;

        // Calculate total_price if quantity or unit_price changed
        let updatedRow = { ...tableData[rowIndex], [fieldName]: value };
        if (fieldName === 'quantity' || fieldName === 'unit_price') {
            const quantity = parseFloat(fieldName === 'quantity' ? value : updatedRow.quantity) || 0;
            const unitPrice = parseFloat(fieldName === 'unit_price' ? value : updatedRow.unit_price) || 0;
            const totalPrice = quantity * unitPrice;
            updatedRow.total_price = totalPrice;
        }

        const newTableData = [...tableData];
        newTableData[rowIndex] = updatedRow;
        props.onChange?.(newTableData);
    };

    // Handler for updating any field in a row (used by child scripts)
    const handleRowFieldUpdate = (rowIndex: number, fieldName: string, value: any) => {
        if (props.readonly) return;
        const newTableData = [...tableData];
        newTableData[rowIndex] = {
            ...newTableData[rowIndex],
            [fieldName]: value
        };
        props.onChange?.(newTableData);
    };

    // Handle drag and drop reordering
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

        props.onChange?.(reorderedData);
    };

    // Create workspace items for drag and drop
    const workspaceItems = useMemo(() => {
        return tableData.map((row, index) => ({
            id: `row_${index}`,
            type: 'table-row',
            data: row,
            workspaceId: 'reference-table' // Dummy workspace ID for drag and drop
        }));
    }, [tableData]);

    // Initialize drag and drop
    const { getDragProps, getDropZoneProps } = useDnd({
        items: workspaceItems,
        onReorder: handleReorder,
        disabled: props.readonly
    });

    const handleEditRow = async (index: number, rowData: any) => {
        if (props.readonly || !doctypeDoc) return;

        // Create a form component for editing the row
        const EditRowDialog = ({ isOpen, onClose, initialData }: { isOpen: boolean; onClose: (result?: any) => void; initialData?: any }) => {

            const formFields = useMemo(() => {
                if (!fields || !doctypeDoc) return {};

                const processedFields: Record<string, any> = {};

                fields.forEach((field) => {
                    if (field.doctype === doctypeDoc?.id && field.reference !== props.fieldOptions.doctype) {
                        if (Object.keys(ClientFieldHelper.standardFields()).includes(field.name)) return {};
                        processedFields[field.name] = {
                            label: field.label || field.name,
                            ...field,
                            type: field.type as any,
                        } satisfies Zodula.Field;
                    }
                });

                return processedFields as Record<string, Zodula.Field>;
            }, [fields, doctypeDoc]);

            const { formData: dialogFormData, handleChange, setValues } = useForm({
                fields: formFields
            });

            // Initialize form data with current row data
            useEffect(() => {
                if (initialData) {
                    setValues(initialData);
                }
            }, [initialData, setValues]);

            // Initialize with current row data and calculate total_price
            useEffect(() => {
                const currentRowData = tableData[index];
                if (currentRowData) {
                    // Calculate total_price if quantity and unit_price exist
                    const quantity = parseFloat(currentRowData.quantity) || 0;
                    const unitPrice = parseFloat(currentRowData.unit_price) || 0;
                    const totalPrice = quantity * unitPrice;

                    // Set the data with calculated total_price
                    const dataWithTotal = {
                        ...currentRowData,
                        total_price: totalPrice > 0 ? totalPrice : currentRowData.total_price
                    };

                    setValues(dataWithTotal);
                }
            }, [index, setValues]);

            // Dialog-only update handler with calculation (no real-time table updates)
            const handleFieldChange = (fieldName: string, value: any) => {
                // Update dialog form
                handleChange(fieldName, value);

                // Calculate total_price if quantity or unit_price changed
                if (fieldName === 'quantity' || fieldName === 'unit_price') {
                    const currentFormData = { ...dialogFormData, [fieldName]: value };
                    const quantity = parseFloat(fieldName === 'quantity' ? value : currentFormData.quantity) || 0;
                    const unitPrice = parseFloat(fieldName === 'unit_price' ? value : currentFormData.unit_price) || 0;
                    const totalPrice = quantity * unitPrice;

                    // Update dialog form with calculated total_price
                    if (totalPrice > 0) {
                        handleChange('total_price', totalPrice);
                    }
                }
            };

            return (
                <div className="zd:px-1 zd:max-h-[80vh] zd:overflow-y-auto zd:w-[90vw] zd:max-w-2xl">
                    <div className="zd:space-y-4">

                        <Form
                            fields={formFields}
                            values={dialogFormData}
                            onChange={handleFieldChange}
                            doctype={doctypeDoc?.id as Zodula.DoctypeName}
                            enableScripts={true}
                            translate
                        />

                        <div className="zd:flex zd:items-center zd:justify-end zd:gap-2 zd:pt-4 zd:border-t">
                            <Button
                                variant="outline"
                                onClick={() => onClose()}
                            >
                                {t("Cancel")}
                            </Button>
                            <Button
                                onClick={() => {
                                    // Final save of all dialog changes to parent
                                    const newTableData = [...tableData];
                                    let finalRowData = { ...newTableData[index], ...dialogFormData };

                                    // Calculate total_price if quantity and unit_price exist
                                    const quantity = parseFloat(finalRowData.quantity) || 0;
                                    const unitPrice = parseFloat(finalRowData.unit_price) || 0;
                                    const totalPrice = quantity * unitPrice;
                                    if (totalPrice > 0) {
                                        finalRowData.total_price = totalPrice;
                                    }

                                    newTableData[index] = finalRowData;
                                    props.onChange?.(newTableData);
                                    onClose();
                                }}
                            >
                                {t("Save")}
                            </Button>
                        </div>
                    </div>
                </div>
            );
        };

        // Open the custom dialog
        const { popup } = await import("../../ui/popit");
        await popup(EditRowDialog, {
            title: `${t("Edit")} ${t(doctypeDoc?.label || doctypeDoc?.id)}`,
            description: `${t("Edit Selected Row")}`
        }, rowData);
    };

    // Get display fields for the table columns
    const displayFields = fields.filter(field =>
        field.doctype === doctypeDoc?.id &&
        (field.in_list_view === 1 || field.required === 1) &&
        !ClientFieldHelper.isStandardField(field.name) &&
        field.reference !== props.fieldOptions.doctype && // Hide self-reference fields
        field.name !== 'idx' // Hide idx field as it's handled separately
    );

    // Create id field for navigation
    // const idField = useMemo(() => ({
    //     name: 'id',
    //     label: 'ID',
    //     type: 'Reference',
    //     reference: doctypeDoc?.id,
    //     readonly: true,
    //     required: false
    // }), [doctypeDoc]);

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
                                    <span className="zd:flex zd:items-center">
                                        {t(field.label || field.name)}
                                        {field.required === 1 && <span className="zd:text-red-500 zd:ml-1 no-print">*</span>}
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
                                        <td className="zd:px-2 zd:py-2  no-print">
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
                                        <td className="zd:px-2 zd:py-2">{index + 1}</td>
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
                                        {displayFields.map((field) => (
                                            <td key={field.name} className="zd:px-2 zd:py-2">
                                                <InlineFieldEditor
                                                    docId={props.docId}
                                                    field={field}
                                                    value={row[field.name]}
                                                    onChange={(value) => handleFieldChange(index, field.name, value)}
                                                    formData={props.formData} // Use parent form data for reference fields (e.g., Invoice data for Invoice Item account field)
                                                    readonly={field.readonly === 1}
                                                    doctype={doctypeDoc?.id}
                                                    onRowUpdate={(fieldName, newValue) => handleRowFieldUpdate(index, fieldName, newValue)}
                                                    fieldPath={`${props.fieldKey}.${index}.${field.name}`} // Pass the nested field path
                                                />
                                            </td>
                                        ))}
                                        <td className="zd:px-2 zd:py-2  no-print">
                                            <div className="zd:flex zd:items-center zd:justify-end zd:gap-1">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => handleEditRow(index, row)}
                                                    disabled={props.readonly}
                                                >
                                                    <Pencil />
                                                </Button>
                                                {!props.readonly && (
                                                    <Button
                                                        variant="ghost"
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
                        >
                            <PlusIcon className="zd:w-4 zd:h-4 zd:mr-1" />
                            {t("Add Row")}
                        </Button>
                    )}
                </div>
                <div className="zd:flex zd:items-center zd:gap-2">
                    {/* <span className="zd:text-sm zd:text-muted-foreground">
                        {tableData.length} {tableData.length === 1 ? 'row' : 'rows'}
                    </span> */}
                </div>
            </div>
        </div>
    );
});
