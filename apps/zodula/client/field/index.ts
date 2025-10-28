export const standardFields = {
    id: {
        type: "Text",
        label: "ID",
        unique: 1,
        default: "HEX()",
        allow_on_submit: 1
    },
    owner: {
        type: "Reference",
        label: "Owner",
        reference: "zodula__User",
        on_delete: "SET NULL",
        allow_on_submit: 1
    },
    created_at: {
        type: "Datetime",
        label: "Created At",
        required: 1,
        default: "NOW()",
        allow_on_submit: 1
    },
    updated_at: {
        type: "Datetime",
        label: "Updated At",
        required: 1,
        default: "NOW()",
        allow_on_submit: 1
    },
    created_by: {
        type: "Reference",
        reference: "zodula__User",
        on_delete: "SET NULL",
        label: "Created By",
        allow_on_submit: 1,
    },
    updated_by: {
        type: "Reference",
        reference: "zodula__User",
        on_delete: "SET NULL",
        label: "Updated By",
        allow_on_submit: 1
    },
    doc_status: {
        type: "Integer",
        required: 1,
        default: "0",
        label: "Document Status",
        allow_on_submit: 1
    },
    idx: {
        type: "Integer",
        label: "Idx",
        default: "0",
        allow_on_submit: 1
    },
    vector: {
        type: "Text",
        label: "Vector",
        default: "[]",
        allow_on_submit: 1
    }
} as const satisfies Record<string, Zodula.Field>

export class ClientFieldHelper {

    static standardFields() {
        return standardFields
    }

    static isStandardField(fieldName: string) {
        return standardFields[fieldName as keyof typeof standardFields]
    }

    static isLayoutField(field: Zodula.Field) {
        return ["Column", "Section", "Tab"].includes(field.type)
    }

    static escapeJSON(json: string) {
        return json.replaceAll('\"', '"')
    }

}