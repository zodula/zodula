import type { SQLType } from "@/zodula/server/field/type"

/**
 * SQL type without NULL option
 */
export type SQLTypeWithoutNULL = Exclude<SQLType, "NULL">

/**
 * Column definition for table creation
 */
export interface ColumnDefinition {
    /** SQL data type for the column */
    type: SQLTypeWithoutNULL
    /** Whether the column should be NOT NULL */
    notNull?: boolean
}

/**
 * Foreign key reference definition
 */
export interface ForeignKeyReference {
    /** Referenced table name */
    table: string
    /** Referenced column names */
    columns: string[]
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
    /** Local column names */
    columns: string[]
    /** Reference definition */
    references: ForeignKeyReference
    /** ON DELETE action */
    onDelete?: string
    /** ON UPDATE action */
    onUpdate?: string
}

/**
 * Constraint definition for table creation
 */
export interface ConstraintDefinition {
    /** Unique constraints */
    unique?: string[][]
    /** Index constraints */
    index?: string[][]
    /** Foreign key constraints */
    foreignKeys?: ForeignKeyDefinition[]
}

/**
 * Columns definition mapping
 */
export type ColumnsDefinition = Record<string, ColumnDefinition>

/**
 * Database operation result
 */
export interface DatabaseOperationResult {
    success: boolean
    error?: string
    data?: any
}

/**
 * SQL query parameters for prepared statements
 */
export interface SQLQueryParams {
    [key: string]: any
}
