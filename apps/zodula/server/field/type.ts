import type { z } from "bxo"
import type { REGISTERED_PLUGINS } from "./plugin"
import type { standardFields } from "../../client/field"

export type SQLType = "TEXT" | "FLOAT" | "NULL" | "INTEGER" | "DATETIME" | "DATE" | "TIME" | "BOOLEAN" | "VARCHAR" | "CHAR" | "STRING" | "NUMBER" | "BIGINT" | "SMALLINT" | "REAL" | "FLOAT" | "DOUBLE" | "DECIMAL" | "NUMERIC"
export type FieldType = keyof typeof REGISTERED_PLUGINS
type StandardFieldsKeys = keyof typeof standardFields

export type FieldTypeToType<T extends FieldType> = z.infer<ReturnType<typeof REGISTERED_PLUGINS[T]["options"]["zodSchema"]>>
export type FieldTypes<T extends Record<string, Zodula.Field>> = {
    [K in keyof T]: T[K]["required"] extends 1 | undefined ? FieldTypeToType<T[K]["type"]> : FieldTypeToType<T[K]["type"]> | null
} & {
    [S in StandardFieldsKeys]: FieldTypeToType<typeof standardFields[S]["type"]>
}

export type REFERENCE_HOOK = "CASCADE" | "SET NULL" | "SET DEFAULT" | "NO ACTION"
