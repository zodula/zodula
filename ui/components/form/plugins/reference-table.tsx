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
import { useDocStore } from "../../../hooks/use-doc-store";
import { useUIScriptStore } from "../../../zui";
import { popup } from "../../ui/popit";

// Inline field editor component for table cells with client scripts
const InlineFieldEditor = ({ field, value, onChange, formData, docId, readonly, doctype, onRowUpdate, fieldPath, childTableFieldPropertyOverrides, childFieldName }: {
    field: any;
    value: any;
    onChange: (value: any) => void;
    formData?: any;
    docId: string;
    readonly?: boolean;
    doctype?: string;
    onRowUpdate?: (fieldName: string, newValue: any) => void;
    fieldPath?: string; // The nested field path (e.g., "invoice_items.0.account")
    childTableFieldPropertyOverrides?: Record<string, Record<number, Record<string, Record<string, any>>>>;
    childFieldName?: string; // The child field name (e.g., "invoice_items")
}) => {
    // Get doc_status from parent document (formData contains parent form data)
    const docStatus = formData?.doc_status ?? 0;
    
    // Check doc_status based readonly conditions for this field
    let statusBasedReadonly = false;
    
    // Access field config properties (allow_on_submit and only_once are direct properties on field)
    // Support both field.config.allow_on_submit (if config exists) and field.allow_on_submit (direct property)
    const allowOnSubmit = (field as any).config?.allow_on_submit ?? field.allow_on_submit;
    const onlyOnce = (field as any).config?.only_once ?? field.only_once;
    
    // Condition 1: doc_status == 1 && field.config.allow_on_submit !== 1
    if (docStatus === 1 && allowOnSubmit !== 1) {
        statusBasedReadonly = true;
    }
    // Condition 2: doc_status == 0 && field.config.only_once == 1
    else if (docStatus === 0 && onlyOnce === 1) {
        statusBasedReadonly = true;
    }
    // Condition 3: doc_status !== 1 && doc_status !== 0
    else if (docStatus !== 1 && docStatus !== 0) {
        statusBasedReadonly = true;
    }
    
    // Combine field readonly with status-based readonly
    const fieldReadonly = readonly || field.readonly === 1 || statusBasedReadonly;
    // Extract index from fieldPath (e.g., "invoice_items.0.account" -> 0)
    const getIndexFromPath = (path?: string, fieldName?: string): number | undefined => {
        if (!path || !fieldName) return undefined;
        const parts = path.split('.');
        const childFieldIndex = parts.indexOf(fieldName);
        if (childFieldIndex >= 0 && childFieldIndex < parts.length - 1) {
            const idxStr = parts[childFieldIndex + 1];
            if (idxStr) {
                const idx = parseInt(idxStr, 10);
                if (!isNaN(idx)) return idx;
            }
        }
        return undefined;
    };

    const rowIndex = childFieldName ? getIndexFromPath(fieldPath, childFieldName) : undefined;
    
    // Get overrides for this specific row index
    // First check for row-specific overrides, then fall back to "all rows" overrides (-1)
    const rowOverrides = childTableFieldPropertyOverrides && childFieldName
        ? (rowIndex !== undefined && childTableFieldPropertyOverrides[childFieldName]?.[rowIndex]
            ? childTableFieldPropertyOverrides[childFieldName][rowIndex]
            : childTableFieldPropertyOverrides[childFieldName]?.[-1]) // Check for "all rows" override
        : undefined;
    
    // Convert row overrides to the format expected by FormControl (childExtendFieldPropertyOverrides)
    // Structure: { fieldName: { property: value } }
    const extendOverrides = rowOverrides ? Object.keys(rowOverrides).reduce((acc, fieldName) => {
        acc[fieldName] = rowOverrides[fieldName] || {};
        return acc;
    }, {} as Record<string, Record<string, any>>) : undefined;

    const handleFieldChange = (fieldName: string, newValue: any) => {
        // Call the parent onChange
        onChange(newValue);
    };

    return (
        <FormControl
            showDescription={false}
            docId={docId}
            field={field}
            fieldKey={field.name}
            value={value}
            onChange={handleFieldChange}
            hideFormControl={true}
            className="zd:h-8"
            formData={formData}
            required={field.required === 1}
            readonly={fieldReadonly}
            fieldPath={fieldPath}
            childExtendFieldPropertyOverrides={extendOverrides}
        />
    );
};

export const ReferenceTablePlugin = new FormPlugin({
    types: ["Reference Table"],
    render: (props) => {
        const { doc: doctypeDoc } = useDoc({
            doctype: "zodula__Doctype",
            id: props.fieldOptions.reference as any
        }, [props.fieldOptions.reference]);

        // Get fields for the reference doctype
        const { docs: fields } = useDocList({
            doctype: "zodula__Field",
            limit: -1,
            sort: "idx",
            order: "asc",
            filters: [["doctype", "=", doctypeDoc?.id]]
        }, [doctypeDoc]);

        const { t } = useTranslation()
        const { fetchDoc, getDoc } = useDocStore();

        // UI script execution for child doctype - will be called per row in handleFieldChange

        // Helper function to get nested value from object using dot notation
        const getNestedValue = (obj: any, path: string): any => {
            return path.split('.').reduce((current, key) => current?.[key], obj);
        };

        // Use props.value directly for table data
        const tableData = useMemo(() => {
            if (!props.value || !Array.isArray(props.value)) return [];
            return props.value;
        }, [props.value]);

        // Track if we've triggered refresh for prefill rows
        const prefillRefreshTriggeredRef = useRef<Set<string>>(new Set());
        const previousTableDataRef = useRef<any[]>([]);

        // Trigger refresh events for child forms when prefill is applied (create mode only)
        useEffect(() => {
            // Only trigger in create mode (when docId is empty or 'new')
            const isCreate = !props.docId || props.docId === 'new' || props.docId === '';
            if (!isCreate || !doctypeDoc?.id) return;

            // Check if rows were just added/initialized (likely from prefill)
            // This happens when tableData goes from empty to having rows, or when rows are first populated
            const wasEmpty = previousTableDataRef.current.length === 0;
            const nowHasRows = tableData.length > 0;
            const rowsJustAdded = wasEmpty && nowHasRows;

            // Also check if rows have key fields populated (indicating prefill)
            const hasPrefillData = tableData.some(row => {
                // Check for common reference field names that would be set by prefill
                return row.sales_invoice || row.purchase_invoice ||
                    (row.id && Object.keys(row).length > 2); // Has id and at least one other field
            });

            if (rowsJustAdded && hasPrefillData) {
                // Create a unique key for this set of rows based on their content
                const rowsKey = JSON.stringify(tableData.map(row => ({
                    id: row.id,
                    // Use a key field that would be set by prefill
                    key: row.sales_invoice || row.purchase_invoice || row.id
                })));

                // Only trigger if we haven't already triggered for this set of rows
                if (!prefillRefreshTriggeredRef.current.has(rowsKey)) {
                    prefillRefreshTriggeredRef.current.add(rowsKey);

                    // Delay to ensure form is fully initialized and parent refresh has completed
                    const timeoutId = setTimeout(async () => {
                        const store = useUIScriptStore.getState();
                        const parentContext = (props as any).parentContext;
                        const setChildFieldProperty = (props as any).setChildFieldProperty;

                        // Trigger events for each row
                        for (let rowIndex = 0; rowIndex < tableData.length; rowIndex++) {
                            let currentRow = { ...tableData[rowIndex] };
                            let currentTableData = [...tableData];

                            // Create context for script execution that uses the latest row data
                            const createContext = (eventType: string, fieldName?: string, value?: any, oldValue?: any) => {
                                // Update currentRow if fieldName is provided (for field_change events)
                                if (eventType === "field_change" && fieldName) {
                                    currentRow = { ...currentRow, [fieldName]: value };
                                }

                                const mergedFormData = { ...props.formData, ...currentRow };

                                return {
                                    formData: mergedFormData,
                                    getValue: (fieldName: string) => mergedFormData[fieldName] || currentRow[fieldName],
                                    getValues: () => mergedFormData,
                                    setValue: (fieldName: string, newValue: any) => {
                                        // Update the row field when UI script calls set_value
                                        currentRow[fieldName] = newValue;
                                        currentTableData[rowIndex] = { ...currentRow };
                                        props.onChange?.(currentTableData);
                                    },
                                    setFieldProperty: (fieldName: string, property: string, value: any) => {
                                        // Set property on child field
                                        if (setChildFieldProperty && props.fieldKey) {
                                            setChildFieldProperty(props.fieldKey, fieldName, property, value);
                                        }
                                    },
                                    parentContext: parentContext,
                                    doctype: doctypeDoc.id as Zodula.DoctypeName,
                                    isCreate: true,
                                    ...(eventType === "field_change" && fieldName ? {
                                        fieldName: fieldName,
                                        value: value,
                                        oldValue: oldValue
                                    } : {})
                                };
                            };

                            // First, trigger refresh event for this row
                            await store.executeScripts(doctypeDoc.id as Zodula.DoctypeName, "refresh", createContext("refresh"));

                            // Then, trigger field_change events for fields that were set via prefill
                            // This ensures that field-specific handlers (like sales_invoice) are also triggered
                            // Sort fields by idx to ensure proper order (e.g., payment_entry before sales_invoice)
                            const prefillFields = Object.entries(currentRow)
                                .filter(([fieldName, fieldValue]) => {
                                    // Skip standard fields and empty values
                                    if (fieldName === 'id' || fieldName === 'idx' || fieldValue === null || fieldValue === undefined || fieldValue === '') {
                                        return false;
                                    }
                                    // Check if this is a field that should trigger field_change (not a standard field)
                                    const field = fields.find(f => f.name === fieldName);
                                    return field && !ClientFieldHelper.isStandardField(fieldName);
                                })
                                .map(([fieldName, fieldValue]) => {
                                    const field = fields.find(f => f.name === fieldName);
                                    return { fieldName, fieldValue, idx: field?.idx || 999 };
                                })
                                .sort((a, b) => a.idx - b.idx);

                            // Trigger field_change events in order
                            for (const { fieldName, fieldValue } of prefillFields) {
                                await store.executeScripts(
                                    doctypeDoc.id as Zodula.DoctypeName,
                                    "field_change",
                                    createContext("field_change", fieldName, fieldValue, undefined)
                                );
                            }
                        }
                    }, 400); // Delay to ensure parent refresh has completed (longer than parent's 200ms)

                    return () => clearTimeout(timeoutId);
                }
            }

            // Update previous table data
            previousTableDataRef.current = tableData;
        }, [tableData, doctypeDoc?.id, props.docId, props.formData, props.onChange, props.fieldKey]);

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

        const handleFieldChange = async (rowIndex: number, fieldName: string, value: any) => {
            if (props.readonly) return;

            let updatedRow = { ...tableData[rowIndex], [fieldName]: value };

            // Handle fetch_from: Find all fields that depend on this field
            const dependentFields: Array<{ fieldName: string; fetchPath: string }> = [];

            // Find all fields that have fetch_from pointing to the changed field
            fields.forEach((field) => {
                if (
                    field.fetch_from &&
                    field.fetch_from.startsWith(fieldName + ".")
                ) {
                    // Extract the path after the source field (e.g., "product_name" from "product.product_name")
                    const fetchPath = field.fetch_from.substring(
                        fieldName.length + 1
                    );
                    dependentFields.push({
                        fieldName: field.name || "",
                        fetchPath: fetchPath,
                    });
                }
            });

            // Fetch data for dependent fields if the value is not empty
            if (dependentFields.length > 0 && value) {
                const sourceField = fields.find(f => f.name === fieldName);

                // Handle Reference field type - need to fetch the referenced document
                if (sourceField?.reference) {
                    try {
                        // Collect all unique root fields to fetch in one call
                        const rootFields = dependentFields
                            .map((df) => {
                                const pathParts = df.fetchPath.split(".");
                                return pathParts[0]; // Get the root field name
                            })
                            .filter((field): field is string => !!field);
                        const fetchFields = [...new Set(rootFields)];

                        // Fetch the referenced document with all needed fields
                        await fetchDoc(
                            sourceField.reference as Zodula.DoctypeName,
                            value,
                            fetchFields
                        );

                        // Get the fetched document from the cache
                        const cachedDoc = getDoc(
                            sourceField.reference as Zodula.DoctypeName,
                            value
                        );

                        if (cachedDoc?.data) {
                            const fetchedDoc = cachedDoc.data;
                            // Update all dependent fields
                            for (const dependentField of dependentFields) {
                                // Support dot notation for nested fields
                                const fetchedValue = getNestedValue(
                                    fetchedDoc,
                                    dependentField.fetchPath
                                );

                                if (fetchedValue !== undefined && fetchedValue !== null) {
                                    // Update the dependent field in the row
                                    updatedRow[dependentField.fieldName] = fetchedValue;
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(
                            `Failed to fetch data for field ${fieldName} in Reference Table row:`,
                            error
                        );
                        // Clear dependent fields if fetch fails
                        for (const dependentField of dependentFields) {
                            updatedRow[dependentField.fieldName] = null;
                        }
                    }
                }
            } else if (dependentFields.length > 0 && !value) {
                // Clear dependent fields if source field is cleared
                for (const dependentField of dependentFields) {
                    updatedRow[dependentField.fieldName] = null;
                }
            }

            // Execute UI scripts for the child doctype (for all field changes)
            if (doctypeDoc?.id) {
                // Merge parent form data with current row data for script context
                const mergedFormData = { ...props.formData, ...updatedRow };

                // Get UI script store and execute scripts
                const store = useUIScriptStore.getState();

                // Get parent context and setChildTableProperty from props
                const parentContext = (props as any).parentContext;
                const setChildTableProperty = (props as any).setChildTableProperty;
                const childTableFieldPropertyOverrides = (props as any).childTableFieldPropertyOverrides || {};

                // Execute scripts with merged form data context
                await store.executeScripts(doctypeDoc.id as Zodula.DoctypeName, "field_change", {
                    fieldName: fieldName,
                    value: value,
                    oldValue: tableData[rowIndex]?.[fieldName],
                    formData: mergedFormData,
                    getValue: (fieldName: string) => mergedFormData[fieldName] || updatedRow[fieldName],
                    getValues: () => mergedFormData,
                    setValue: (fieldName: string, newValue: any) => {
                        // Update the row field when UI script calls set_value
                        updatedRow[fieldName] = newValue;
                    },
                    setFieldProperty: (fieldName: string, property: string, value: any) => {
                        // Set property on child field using setChildTableProperty with row index
                        if (setChildTableProperty && props.fieldKey) {
                            setChildTableProperty(props.fieldKey, rowIndex, fieldName, property, value);
                        }
                    },
                    parentContext: parentContext,
                    doctype: doctypeDoc.id as Zodula.DoctypeName,
                    isCreate: true,
                });
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
                    
                    // Get doc_status from parent document
                    const docStatus = props.formData?.doc_status ?? 0;

                    fields.forEach((field) => {
                        if (field.doctype === doctypeDoc?.id && field.reference !== props.fieldOptions.doctype) {
                            if (Object.keys(ClientFieldHelper.standardFields()).includes(field.name)) return {};
                            
                            // Check doc_status based readonly conditions
                            let statusBasedReadonly = false;
                            
                            // Access field config properties (allow_on_submit and only_once are direct properties on field)
                            // Support both field.config.allow_on_submit (if config exists) and field.allow_on_submit (direct property)
                            const allowOnSubmit = (field as any).config?.allow_on_submit ?? field.allow_on_submit;
                            const onlyOnce = (field as any).config?.only_once ?? field.only_once;
                            
                            // Condition 1: doc_status == 1 && field.config.allow_on_submit !== 1
                            if (docStatus === 1 && allowOnSubmit !== 1) {
                                statusBasedReadonly = true;
                            }
                            // Condition 2: doc_status == 0 && field.config.only_once == 1
                            else if (docStatus === 0 && onlyOnce === 1) {
                                statusBasedReadonly = true;
                            }
                            // Condition 3: doc_status !== 1 && doc_status !== 0
                            else if (docStatus !== 1 && docStatus !== 0) {
                                statusBasedReadonly = true;
                            }
                            
                            processedFields[field.name] = {
                                label: field.label || field.name,
                                ...field,
                                type: field.type as any,
                                // Set readonly based on field's readonly property and status-based conditions
                                readonly: (field.readonly === 1 || statusBasedReadonly) ? 1 : (field.readonly || 0),
                            } satisfies Zodula.Field;
                        }
                    });

                    return processedFields as Record<string, Zodula.Field>;
                }, [fields, doctypeDoc, props.formData]);

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

                // Trigger refresh event when dialog opens (similar to table list)
                const refreshTriggeredRef = useRef(false);
                useEffect(() => {
                    if (!doctypeDoc?.id || refreshTriggeredRef.current) return;
                    
                    // Delay to ensure form is fully initialized
                    const timeoutId = setTimeout(async () => {
                        refreshTriggeredRef.current = true;
                        const store = useUIScriptStore.getState();
                        const parentContext = (props as any).parentContext;
                        const setChildFieldProperty = (props as any).setChildFieldProperty;
                        
                        // Merge parent form data with dialog form data for script context
                        const mergedFormData = { ...props.formData, ...dialogFormData };
                        
                        // Create context for script execution
                        const context = {
                            formData: mergedFormData,
                            getValue: (fieldName: string) => mergedFormData[fieldName] || dialogFormData[fieldName],
                            getValues: () => mergedFormData,
                            setValue: (fieldName: string, newValue: any) => {
                                handleChange(fieldName, newValue);
                            },
                            setFieldProperty: (fieldName: string, property: string, value: any) => {
                                if (setChildFieldProperty && props.fieldKey) {
                                    setChildFieldProperty(props.fieldKey, fieldName, property, value);
                                }
                            },
                            parentContext: parentContext,
                            doctype: doctypeDoc.id as Zodula.DoctypeName,
                            isCreate: true,
                        };
                        
                        // Trigger refresh event
                        await store.executeScripts(doctypeDoc.id as Zodula.DoctypeName, "refresh", context);
                    }, 200); // Delay to ensure form is fully initialized
                    
                    return () => clearTimeout(timeoutId);
                }, [doctypeDoc?.id]);

                // Dialog-only update handler with calculation and UI script execution
                const handleFieldChange = async (fieldName: string, value: any) => {
                    // Get old value before updating
                    const oldValue = dialogFormData[fieldName];
                    
                    // Update dialog form
                    handleChange(fieldName, value);

                    // Create updated form data for script context
                    let updatedFormData = { ...dialogFormData, [fieldName]: value };

                    // Execute UI scripts for the child doctype (similar to table list)
                    if (doctypeDoc?.id) {
                        // Merge parent form data with dialog form data for script context
                        let mergedFormData = { ...props.formData, ...updatedFormData };

                        // Get UI script store and execute scripts
                        const store = useUIScriptStore.getState();

                        // Get parent context and setChildFieldProperty from props
                        const parentContext = (props as any).parentContext;
                        const setChildFieldProperty = (props as any).setChildFieldProperty;

                        // Execute scripts with merged form data context
                        await store.executeScripts(doctypeDoc.id as Zodula.DoctypeName, "field_change", {
                            fieldName: fieldName,
                            value: value,
                            oldValue: oldValue,
                            formData: mergedFormData,
                            getValue: (fieldName: string) => mergedFormData[fieldName] || updatedFormData[fieldName],
                            getValues: () => mergedFormData,
                            setValue: (fieldName: string, newValue: any) => {
                                // Update the dialog form field when UI script calls set_value
                                updatedFormData[fieldName] = newValue;
                                mergedFormData = { ...props.formData, ...updatedFormData };
                                handleChange(fieldName, newValue);
                            },
                            setFieldProperty: (fieldName: string, property: string, value: any) => {
                                // Set property on child field
                                if (setChildFieldProperty && props.fieldKey) {
                                    setChildFieldProperty(props.fieldKey, fieldName, property, value);
                                }
                            },
                            parentContext: parentContext,
                            doctype: doctypeDoc.id as Zodula.DoctypeName,
                            isCreate: true,
                        });
                    }

                    // Calculate total_price if quantity or unit_price changed
                    if (fieldName === 'quantity' || fieldName === 'unit_price') {
                        const currentFormData = { ...updatedFormData };
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
                    <div className="zd:space-y-4 zd:w-[90vw] zd:max-w-2xl">

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
                );
            };

            // Open the custom dialog
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
                                                        formData={{ ...props.formData, ...row }} // Merge parent and row data so dynamic references can resolve from row fields first, then parent fields
                                                        readonly={field.readonly === 1}
                                                        doctype={doctypeDoc?.id}
                                                        onRowUpdate={(fieldName, newValue) => handleRowFieldUpdate(index, fieldName, newValue)}
                                                        fieldPath={`${props.fieldKey}.${index}.${field.name}`} // Pass the nested field path
                                                        childTableFieldPropertyOverrides={(props as any).childTableFieldPropertyOverrides}
                                                        childFieldName={props.fieldKey}
                                                    />
                                                </td>
                                            ))}
                                            <td className="zd:px-2 zd:py-2 no-print zd:sticky zd:right-0">
                                                <div className="zd:flex zd:items-center zd:justify-end zd:gap-1 zd:bg-muted zd:rounded-lg zd:border">
                                                    <Button
                                                        hideLoading
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
    }
});

