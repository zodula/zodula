import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Form } from "../form";
import { useDocListAll } from "../../../hooks/use-doc-list-all";
import { useDocAll } from "../../../hooks/use-doc-all";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useZui } from "@/zodula/ui";
import { useRouter } from "../../router";
import { popup } from "../../ui/popit";
import { useDocStore } from "../../../hooks/use-doc-store";

export const ExtendPlugin = new FormPlugin({
    types: ["Extend"],
    render: (props: {
        fieldOptions: Zodula.Field;
        value?: any;
        onChange?: (fieldPath: string, value: any) => void;
        onBlur?: (fieldPath: string, value: any) => void;
        readonly?: boolean;
        multiple?: boolean;
        fieldKey?: string;
        formData?: any;
        docId: string;
        fieldPath?: string;
        doctype?: Zodula.DoctypeConfig;
    }) => {
        const zui = useZui();
        const { doc: doctypeDoc } = useDocAll({
            doctype: "Doctype",
            id: props.fieldOptions.reference as any
        });

        const { push } = useRouter();
        const { fetchDoc, getDoc } = useDocStore();

        // Helper function to get nested value from object using dot notation
        const getNestedValue = (obj: any, path: string): any => {
            if (!obj || !path) return undefined;
            return path.split('.').reduce((current, key) => current?.[key], obj);
        };

        // Client script hook for the child doctype
        // const { execute } = useUIScript(doctypeDoc?.id || '', {
        //     formData: props.value,
        //     setValue: (fieldName: string, newValue: any) => {
        //         console.log(`Extend script: setValue called for ${fieldName} = ${newValue}`);
        //     },
        //     getValue: (fieldName: string) => props.value?.[fieldName],
        //     getValues: () => props.value || {},
        //     docId: props.value?.id,
        //     isCreate: props.value?.doc_status === "Draft",
        //     showToast: (message, type) => {
        //         console.log(`${type}: ${message}`);
        //     },
        //     showDialog: async (component, dialogProps) => {
        //         return await popup(component, dialogProps);
        //     },
        //     navigate: (path) => push(path)
        // });

        // Fetch all fields with persistent caching, then filter client-side
        const { docs: allFields } = useDocListAll({
            doctype: "Field"
        });

        // Filter fields by doctype and sort by idx
        const fields = useMemo(() => {
            if (!doctypeDoc?.id) return [];
            return allFields
                .filter((field) => field.doctype === doctypeDoc.id)
                .sort((a, b) => (a.idx || 0) - (b.idx || 0));
        }, [allFields, doctypeDoc?.id]);

        // Process fields and filter out self-references
        const formFields = useMemo(() => {
            if (!fields || !doctypeDoc) return {};

            const processedFields: Record<string, any> = {};

            // Get doc_status from parent document (props.formData) or from extend field value (props.value)
            const docStatus = props.formData?.doc_status ?? props.value?.doc_status ?? "Draft";

            fields.forEach((field) => {
                if (field.doctype === doctypeDoc?.id && field.reference !== props.fieldOptions.doctype) {
                    if (Object.keys(ClientFieldHelper.standardFields()).includes(field.name)) return;

                    // Check doc_status based readonly conditions
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
        }, [fields, doctypeDoc, props.fieldOptions.doctype, props.formData, props.value]);

        // Helper function to set nested field values in objects
        const setNestedField = (obj: any, fieldPath: string, value: any) => {
            const parts = fieldPath.split('.');
            let current = obj;

            // Navigate to the parent of the target field
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (part && !current[part]) {
                    current[part] = {};
                }
                if (part) {
                    current = current[part];
                }
            }

            // Set the final field value
            const finalField = parts[parts.length - 1];
            if (finalField) {
                current[finalField] = value;
            }
        };

        const handleFieldChange = async (fieldName: string, value: any) => {
            if (props.readonly) return;

            const oldValue = props.value?.[fieldName];
            let newValue = {
                ...props.value,
                [fieldName]: value
            };

            // Find dependent fields that use fetch_from on this field
            const dependentFields: Array<{ fieldName: string; fetchPath: string }> = [];
            fields.forEach((field) => {
                if (
                    field.fetch_from &&
                    field.fetch_from.startsWith(fieldName + ".")
                ) {
                    const fetchPath = field.fetch_from.substring(
                        fieldName.length + 1
                    );
                    dependentFields.push({
                        fieldName: field.name || "",
                        fetchPath: fetchPath,
                    });
                }
            });

            // Handle fetch_from logic before running scripts
            if (dependentFields.length > 0 && value) {
                const sourceField = fields.find(f => f.name === fieldName);

                // Handle Reference field type - need to fetch the referenced document
                if (sourceField?.reference) {
                    try {
                        // Collect all unique root fields to fetch in one call
                        const rootFields = dependentFields
                            .map((df) => df.fetchPath.split(".")[0])
                            .filter((v): v is string => !!v);
                        const fetchFields = [...new Set(rootFields)];

                        await fetchDoc(
                            sourceField.reference as Zodula.DoctypeName,
                            value,
                            fetchFields
                        );

                        const cachedDoc = getDoc(
                            sourceField.reference as Zodula.DoctypeName,
                            value
                        );

                        if (cachedDoc?.data) {
                            const fetchedDoc = cachedDoc.data;
                            for (const dependentField of dependentFields) {
                                // Get the field config for the field that will RECEIVE the value (the field in the child doctype)
                                const receivingFieldConfig = fields.find(f => f.name === dependentField.fieldName);

                                const fetchedValue = getNestedValue(
                                    fetchedDoc,
                                    dependentField.fetchPath
                                );

                                // Check if the RECEIVING field is an Image Preview field that should construct a file path
                                if (receivingFieldConfig?.type === "Image Preview" && fetchedValue !== undefined && fetchedValue !== null && fetchedValue !== "") {
                                    // Construct file path: /files/<referenced_doctype>/<referenced_id>/<field_name>/<field_value>
                                    // fetchPath might be nested like "customer.logo" or just "logo"
                                    const fetchPathParts = dependentField.fetchPath.split('.');
                                    const parentFieldName = fetchPathParts[fetchPathParts.length - 1];
                                    const filePath = `/files/${sourceField.reference}/${value}/${parentFieldName}/${fetchedValue}`;
                                    newValue[dependentField.fieldName] = filePath;
                                } else if (fetchedValue !== undefined && fetchedValue !== null) {
                                    // Regular field update (for non-Image Preview fields)
                                    newValue[dependentField.fieldName] = fetchedValue;
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(
                            `Failed to fetch data for field ${fieldName} in Extend field:`,
                            error
                        );
                        // Clear dependent fields if fetch fails
                        for (const dependentField of dependentFields) {
                            newValue[dependentField.fieldName] = null;
                        }
                    }
                }
            } else if (dependentFields.length > 0 && !value) {
                // Clear dependent fields if source field is cleared
                for (const dependentField of dependentFields) {
                    newValue[dependentField.fieldName] = null;
                }
            }

            // If we have a fieldPath (nested field), update the parent object structure
            if (props.fieldPath && props.fieldPath.includes('.')) {
                // Create a deep copy of the parent form data
                const parentFormData = { ...props.formData };

                // Update the nested field in the parent structure
                setNestedField(parentFormData, props.fieldPath, newValue);

                // Use the updated parent form data
                newValue = parentFormData;
            }

            props.onChange?.(props.fieldPath || "", newValue);
        };

        return (
            <div className="zd:space-y-4 zd:border-dashed zd:border-1 zd:rounded-md zd:p-3">
                <Form
                    docId={props.value?.id || ""}
                    fields={formFields}
                    values={props.value || {}}
                    onChange={handleFieldChange}
                    readonly={props.readonly}
                    doctype={doctypeDoc as unknown as Zodula.DoctypeConfig}
                    enableScripts={true}
                />
            </div>
        );
    }
});
