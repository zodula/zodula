import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Form } from "../form";
import { useDocListAll } from "../../../hooks/use-doc-list-all";
import { useDocAll } from "../../../hooks/use-doc-all";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useUIScript } from "@/zodula/ui";
import { useRouter } from "../../router";
import { popup } from "../../ui/popit";

export const ExtendPlugin = new FormPlugin({
    types: ["Extend"],
    render: (props: {
    fieldOptions: Zodula.Field;
    value?: any;
    onChange?: (value: any) => void;
    onBlur?: (value: any) => void;
    readonly?: boolean;
    multiple?: boolean;
    fieldKey?: string;
    formData?: any;
    docId: string;
    fieldPath?: string;
}) => {
    const { doc: doctypeDoc } = useDocAll({
        doctype: "zodula__Doctype",
        id: props.fieldOptions.reference as any
    });

    const { push } = useRouter();

    // Client script hook for the child doctype
    const { execute } = useUIScript(doctypeDoc?.id || '', {
        formData: props.value,
        setValue: (fieldName: string, newValue: any) => {
            console.log(`Extend script: setValue called for ${fieldName} = ${newValue}`);
        },
        getValue: (fieldName: string) => props.value?.[fieldName],
        getValues: () => props.value || {},
        docId: props.value?.id,
        isCreate: !props.value?.doc_status,
        showToast: (message, type) => {
            console.log(`${type}: ${message}`);
        },
        showDialog: async (component, dialogProps) => {
            return await popup(component, dialogProps);
        },
        navigate: (path) => push(path)
    });

    // Fetch all fields with persistent caching, then filter client-side
    const { docs: allFields } = useDocListAll({
        doctype: "zodula__Field"
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
        const docStatus = props.formData?.doc_status ?? props.value?.doc_status ?? 0;

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

        // If we have a fieldPath (nested field), update the parent object structure
        if (props.fieldPath && props.fieldPath.includes('.')) {
            // Create a deep copy of the parent form data
            const parentFormData = { ...props.formData };

            // Update the nested field in the parent structure
            setNestedField(parentFormData, props.fieldPath, newValue);

            // Use the updated parent form data
            newValue = parentFormData;
        }

        // Execute child doctype scripts if enabled
        if (doctypeDoc?.id) {
            console.log(`Extend script: Executing scripts for field_change on ${fieldName} in ${doctypeDoc.id}`);
            await execute('field_change', fieldName, {
                fieldName: fieldName,
                value: value,
                oldValue: oldValue,
                formData: newValue,
                getValue: (fieldName: string) => newValue[fieldName],
                getValues: () => newValue
            });
        }

        props.onChange?.(newValue);
    };

    return (
        <div className="zd:space-y-4 zd:border-dashed zd:border-1 zd:rounded-md zd:p-3">
            <Form
                docId={props.value?.id || ""}
                fields={formFields}
                values={props.value || {}}
                onChange={handleFieldChange}
                readonly={props.readonly}
                doctype={doctypeDoc?.id as Zodula.DoctypeName}
                enableScripts={true}
            />
        </div>
    );
    }
});
