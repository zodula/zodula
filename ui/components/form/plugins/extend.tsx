import React, { useMemo } from "react";
import { FormPlugin } from "../plugin";
import { Form } from "../form";
import { useDocList } from "../../../hooks/use-doc-list";
import { useDoc } from "../../../hooks/use-doc";
import { ClientFieldHelper } from "@/zodula/client/field";
import { useUIScript } from "@/zodula/ui/hooks/use-ui-script";
import { useRouter } from "../../router";
import { popup } from "../../ui/popit";

export const ExtendPlugin = new FormPlugin(["Extend"], (props: {
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
    const { doc: doctypeDoc } = useDoc({
        doctype: "zodula__Doctype",
        id: props.fieldOptions.reference as any
    }, [props.fieldOptions.reference]);

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

    // Get fields for the reference doctype
    const { docs: fields } = useDocList({
        doctype: "zodula__Field",
        limit: 1000000,
        sort: "idx",
        order: "asc",
        filters: [["doctype", "=", doctypeDoc?.id]]
    }, [doctypeDoc]);

    // Process fields and filter out self-references
    const formFields = useMemo(() => {
        if (!fields || !doctypeDoc) return {};

        const processedFields: Record<string, any> = {};

        fields.forEach((field) => {
            if (field.doctype === doctypeDoc?.id && field.reference !== props.fieldOptions.doctype) {
                if (Object.keys(ClientFieldHelper.standardFields()).includes(field.name)) return;
                processedFields[field.name] = {
                    label: field.label || field.name,
                    ...field,
                    type: field.type as any,
                } satisfies Zodula.Field;
            }
        });

        return processedFields as Record<string, Zodula.Field>;
    }, [fields, doctypeDoc, props.fieldOptions.doctype]);

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
});
