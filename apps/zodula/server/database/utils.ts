/**
 * Database utility functions
 */

/**
 * Normalize column names by removing quotes and converting to lowercase
 */
export function normalizeName(name: string): string {
    return name.replaceAll(`"`, "").toLowerCase()
}

/**
 * Escape SQL identifiers to prevent injection
 */
export function escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * Escape SQL string values to prevent injection
 */
export function escapeString(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

/**
 * Generate constraint name based on table and columns
 */
export function generateConstraintName(prefix: string, tableName: string, columns: string[]): string {
    const normalizedTable = normalizeName(tableName)
    const normalizedColumns = columns.map(normalizeName).join("_")
    return `${prefix}_${normalizedTable}_${normalizedColumns}`
}

/**
 * Generate unique constraint name
 */
export function generateUniqueConstraintName(tableName: string, columns: string[]): string {
    return generateConstraintName("unique", tableName, columns)
}

/**
 * Generate foreign key constraint name
 */
export function generateForeignKeyConstraintName(tableName: string, columns: string[]): string {
    return generateConstraintName("fk", tableName, columns)
}

/**
 * Generate index name
 */
export function generateIndexName(tableName: string, column: string): string {
    return `${normalizeName(tableName)}_${normalizeName(column)}_idx`
}

/**
 * Validate table name format
 */
export function validateTableName(tableName: string): boolean {
    // Basic validation - can be extended
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)
}

/**
 * Validate column name format
 */
export function validateColumnName(columnName: string): boolean {
    // Basic validation - can be extended
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)
}

/**
 * Create a temporary table name
 */
export function createTempTableName(originalName: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${originalName}_temp_${timestamp}_${random}`
}
