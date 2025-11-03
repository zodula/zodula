import { BaseFieldPlugin } from "./base"
import { z } from "bxo"
import type { FieldType } from "./type"
import { loader } from "../loader"
import { standardFields } from "../../client/field"

// // Text-based field types
export const TextFieldPlugin = new BaseFieldPlugin({
    fieldType: "Text",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

// Long Text field type
export const LongTextFieldPlugin = new BaseFieldPlugin({
    fieldType: "Long Text",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

// Password field type
export const PasswordFieldPlugin = new BaseFieldPlugin({
    fieldType: "Password",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

export const DataFieldPlugin = new BaseFieldPlugin({
    fieldType: "Data",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

export const EmailFieldPlugin = new BaseFieldPlugin({
    fieldType: "Email",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

// Integer field type
export const IntegerFieldPlugin = new BaseFieldPlugin({
    fieldType: "Integer",
    sqlType: "INTEGER",
    typescriptType: (fieldConfig) => "number",
    zodSchema: (fieldConfig) => z.coerce.number(),
    textZodSchema: () => `z.coerce.number()`
})

// Numeric field types
export const FloatFieldPlugin = new BaseFieldPlugin({
    fieldType: "Float",
    sqlType: "FLOAT",
    typescriptType: (fieldConfig) => "number",
    zodSchema: (fieldConfig) => z.coerce.number(),
    textZodSchema: () => `z.coerce.number()`
})

export const CurrencyFieldPlugin = new BaseFieldPlugin({
    fieldType: "Currency",
    sqlType: "FLOAT",
    typescriptType: (fieldConfig) => "number",
    zodSchema: (fieldConfig) => z.coerce.number(),
    textZodSchema: () => `z.coerce.number()`
})

// Boolean field types
export const CheckFieldPlugin = new BaseFieldPlugin({
    fieldType: "Check",
    sqlType: "INTEGER",
    typescriptType: (fieldConfig) => "0 | 1",
    zodSchema: (fieldConfig) => z.coerce.number().int().min(0).max(1),
    textZodSchema: () => `z.coerce.number()`
})

// JSON field type
export const JSONFieldPlugin = new BaseFieldPlugin({
    fieldType: "JSON",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

export const CodeFieldPlugin = new BaseFieldPlugin({
    fieldType: "Code",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

// Select field type
export const SelectFieldPlugin = new BaseFieldPlugin({
    fieldType: "Select",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => {
        return `"${fieldConfig.options?.split('\n').map((opt: string) => opt.trim()).join('" | "')}"`
    },
    zodSchema: (fieldConfig) => z.enum(fieldConfig.options?.split('\n').map((opt: string) => opt.trim()) || []),
    textZodSchema: (fieldConfig) => {
        if (fieldConfig.options) {
            const options = fieldConfig.options.split('\n').map((opt: string) => opt.trim());
            return `z.enum([${options.map((opt: string) => `"${opt}"`).join(", ")}])`;
        } else {
            return `z.string()`;
        }
    }
})

// File field type
export const FileFieldPlugin = new BaseFieldPlugin({
    fieldType: "File",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string | File",
    zodSchema: (fieldConfig) => z.union([z.string(), z.file()]),
    textZodSchema: () => `z.union([z.string(), z.file()])`
})

// Reference field types
export const ReferenceFieldPlugin = new BaseFieldPlugin({
    fieldType: "Reference",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string().optional(),
    textZodSchema: () => `z.string()`
})

export const VirtualReferenceFieldPlugin = new BaseFieldPlugin({
    fieldType: "Virtual Reference",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})



// // Layout field types (these don't generate Zod schemas)
// export const SectionFieldPlugin = new BaseFieldPlugin({
//     fieldType: "Section",
//     sqlType: "NULL",
//     typescriptType: (fieldConfig) => "never",
//     zodSchema: (fieldConfig) => z.never(),
//     textZodSchema: () => null
// })

// export const ColumnFieldPlugin = new BaseFieldPlugin({
//     fieldType: "Column",
//     sqlType: "NULL",
//     typescriptType: (fieldConfig) => "never",
//     zodSchema: (fieldConfig) => z.never(),
//     textZodSchema: () => null
// })

// export const TabFieldPlugin = new BaseFieldPlugin({
//     fieldType: "Tab",
//     sqlType: "NULL",
//     typescriptType: (fieldConfig) => "never",
//     zodSchema: (fieldConfig) => z.never(),
//     textZodSchema: () => null
// })

// Date, Time, Datetime field types
export const DateFieldPlugin = new BaseFieldPlugin({
    fieldType: "Date",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

export const DatetimeFieldPlugin = new BaseFieldPlugin({
    fieldType: "Datetime",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

export const TimeFieldPlugin = new BaseFieldPlugin({
    fieldType: "Time",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "string",
    zodSchema: (fieldConfig) => z.string(),
    textZodSchema: () => `z.string()`
})

// Reference Relative field type
export const ReferenceTableFieldPlugin = new BaseFieldPlugin({
    fieldType: "Reference Table",
    sqlType: "NULL",
    typescriptType: (fieldConfig) => `SelectDoctype<"${fieldConfig.reference}">[]`,
    zodSchema: (fieldConfig) => {
        const doctype = loader.from("doctype").get(fieldConfig.reference as Zodula.DoctypeName)
        return z.array(FieldHelper.doctypeToZod(doctype.schema))
    },
    textZodSchema: (fieldConfig) => {
        return `z.array(baseDoctypeZods["${fieldConfig.reference}"])`
    }
})

export const ExtendFieldPlugin = new BaseFieldPlugin({
    fieldType: "Extend",
    sqlType: "NULL",
    typescriptType: (fieldConfig) => `SelectDoctype<"${fieldConfig.reference}">`,
    zodSchema: (fieldConfig) => {
        const doctype = loader.from("doctype").get(fieldConfig.reference as Zodula.DoctypeName)
        return FieldHelper.doctypeToZod(doctype.schema)
    },
    textZodSchema: (fieldConfig) => {
        return `baseDoctypeZods["${fieldConfig.reference}"]`
    }
})


export const VectorFieldPlugin = new BaseFieldPlugin({
    fieldType: "Vector",
    sqlType: "TEXT",
    typescriptType: (fieldConfig) => "number[]",
    zodSchema: (fieldConfig) => z.array(z.number()),
    textZodSchema: () => `z.array(z.number())`
})

// Register all plugins (strongly-typed)
export const REGISTERED_PLUGINS = {
    Text: TextFieldPlugin,
    "Long Text": LongTextFieldPlugin,
    Password: PasswordFieldPlugin,
    Data: DataFieldPlugin,
    Email: EmailFieldPlugin,
    Integer: IntegerFieldPlugin,
    Float: FloatFieldPlugin,
    Currency: CurrencyFieldPlugin,
    Check: CheckFieldPlugin,
    JSON: JSONFieldPlugin,
    Code: CodeFieldPlugin,
    Select: SelectFieldPlugin,
    File: FileFieldPlugin,
    Reference: ReferenceFieldPlugin,
    "Virtual Reference": VirtualReferenceFieldPlugin,
    Date: DateFieldPlugin,
    Datetime: DatetimeFieldPlugin,
    Time: TimeFieldPlugin,
    "Reference Table": ReferenceTableFieldPlugin,
    Extend: ExtendFieldPlugin,
    Vector: VectorFieldPlugin
} as const



const fieldPlugins = new Map<FieldType, BaseFieldPlugin>(Object.entries(REGISTERED_PLUGINS) as [FieldType, BaseFieldPlugin][])

function getPluginOrThrow(fieldType: FieldType | string | undefined): BaseFieldPlugin {
    const fieldPlugin = fieldPlugins.get(fieldType as FieldType)
    if (!fieldPlugin) {
        throw new Error(`Field type ${fieldType} not found`)
    }
    return fieldPlugin
}


export class FieldHelper {

    static getFieldTypes() {
        return Object.keys(REGISTERED_PLUGINS)
    }

    static getTextZodSchema(field: Zodula.Field) {
        return getPluginOrThrow(field.type).options.textZodSchema(field)
    }

    static getSQLiteType(fieldType: FieldType) {
        return getPluginOrThrow(fieldType).options.sqlType
    }

    static getTypescriptType(field: Zodula.Field) {
        return getPluginOrThrow(field.type).options.typescriptType(field)
    }

    static getZodSchema(field: Zodula.Field) {
        return getPluginOrThrow(field.type).generateZodSchema(field)
    }

    static getFieldPlugin(fieldType: FieldType) {
        return fieldPlugins.get(fieldType as FieldType)
    }

    static fieldToZod(field: Zodula.Field) {
        return getPluginOrThrow(field.type).generateZodSchema(field)
    }

    static doctypeToZod(doctype: Zodula.DoctypeSchema, options?: {
        withOutStandardFields?: boolean
    }) {
        let properties: Record<string, any> = {};
        for (const [fieldName, fieldConfig] of Object.entries(doctype.fields)) {
            const fieldSchema = FieldHelper.getZodSchema(fieldConfig).nullable().optional();
            properties[fieldName] = fieldSchema;
            if (standardFields[fieldName as keyof typeof standardFields]) {
                properties[fieldName] = fieldSchema.nullish().optional();
            }
        }
        if (options?.withOutStandardFields) {
            properties = Object.fromEntries(Object.entries(properties).filter(([fieldName]) => !standardFields[fieldName as keyof typeof standardFields]))
        }
        return z.object({
            ...properties
        })
    }

    static doctypeToZodWithoutRelatives(doctype: Zodula.DoctypeSchema) {
        const fields = Object.fromEntries(Object.entries(doctype.fields).filter(([fieldName]) => !["Reference Table", "Extend"].includes(doctype.fields[fieldName as keyof typeof doctype.fields]?.type || "")))
        return FieldHelper.doctypeToZod({
            ...doctype,
            fields: fields
        })
    }

    static withoutStandardFields(doctype: Zodula.DoctypeSchema): Zodula.DoctypeSchema {
        return {
            ...doctype,
            fields: Object.fromEntries(Object.entries(doctype.fields).filter(([fieldName]) => !standardFields[fieldName as keyof typeof standardFields]))
        }
    }
}