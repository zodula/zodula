// import type { 
//     ColumnsDefinition, 
//     ConstraintDefinition,
//     DatabaseOperationResult 
// } from "./types"
// import type { DatabaseSchemaName } from "./database"
// import type { Bunely } from "bunely"

// /**
//  * SQL Runner for executing database operations with error handling
//  */
// export class SQLRunner {
//     constructor(
//         private schema: DatabaseSchemaName,
//         private db: Bunely
//     ) {}

//     /**
//      * Create a table with columns and constraints
//      */
//     async createTable(
//         tableName: string, 
//         columns: ColumnsDefinition, 
//         constraints?: ConstraintDefinition
//     ): Promise<DatabaseOperationResult> {
//         try {
//             // For now, use raw SQL to create tables
//             // This is a simplified approach - in production you'd want to use the schema builder
//             const columnDefs = Object.entries(columns)
//                 .map(([name, def]) => {
//                     let sql = `"${name}" ${def.type}`
//                     if (def.notNull) sql += " NOT NULL"
//                     return sql
//                 })
//                 .join(", ")

//             let createSQL = `CREATE TABLE "${tableName}" (${columnDefs})`
//             await this.db.run(createSQL)

//             // Add constraints if provided
//             if (constraints) {
//                 if (constraints.unique) {
//                     for (const uniqueCols of constraints.unique) {
//                         const constraintName = `unique_${tableName}_${uniqueCols.join("_")}`
//                         await this.db.run(
//                             `CREATE UNIQUE INDEX "${constraintName}" ON "${tableName}" (${uniqueCols.map(c => `"${c}"`).join(", ")})`
//                         )
//                     }
//                 }
//                 if (constraints.index) {
//                     for (const indexCols of constraints.index) {
//                         const indexName = `idx_${tableName}_${indexCols.join("_")}`
//                         await this.db.run(
//                             `CREATE INDEX "${indexName}" ON "${tableName}" (${indexCols.map(c => `"${c}"`).join(", ")})`
//                         )
//                     }
//                 }
//             }

//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Drop a table
//      */
//     async dropTable(tableName: string): Promise<DatabaseOperationResult> {
//         try {
//             await this.db.schema.dropTable(tableName)
//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Add a column to an existing table
//      */
//     async addColumn(tableName: string, columnName: string, type: string): Promise<DatabaseOperationResult> {
//         try {
//             await this.db.run(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${type}`)
//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Add a unique constraint
//      */
//     async addUnique(tableName: string, columns: string[]): Promise<DatabaseOperationResult> {
//         try {
//             const constraintName = `unique_${tableName}_${columns.join("_")}`
//             await this.db.run(
//                 `CREATE UNIQUE INDEX "${constraintName}" ON "${tableName}" (${columns.map(c => `"${c}"`).join(", ")})`
//             )
//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Add an index
//      */
//     async addIndex(tableName: string, columns: string[]): Promise<DatabaseOperationResult> {
//         try {
//             const indexName = `idx_${tableName}_${columns.join("_")}`
//             await this.db.run(
//                 `CREATE INDEX "${indexName}" ON "${tableName}" (${columns.map(c => `"${c}"`).join(", ")})`
//             )
//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Add a foreign key constraint
//      */
//     async addForeignKey(
//         tableName: string,
//         columns: string[],
//         references: { table: string; columns: string[] },
//         onDelete?: string,
//         onUpdate?: string
//     ): Promise<DatabaseOperationResult> {
//         try {
//             const fkName = `fk_${tableName}_${columns.join("_")}`
//             let sql = `ALTER TABLE "${tableName}" ADD CONSTRAINT "${fkName}" FOREIGN KEY (${columns.map(c => `"${c}"`).join(", ")}) REFERENCES "${references.table}" (${references.columns.map(c => `"${c}"`).join(", ")})`
            
//             if (onDelete) sql += ` ON DELETE ${onDelete}`
//             if (onUpdate) sql += ` ON UPDATE ${onUpdate}`
            
//             await this.db.run(sql)
//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }

//     /**
//      * Clean up temporary tables
//      */
//     async cleanupTempTables(): Promise<DatabaseOperationResult> {
//         try {
//             // Get all tables that start with temp_
//             const tables = await (this.db as any).prepare(`
//                 SELECT name FROM sqlite_master 
//                 WHERE type='table' AND name LIKE 'temp_%'
//             `).all()

//             for (const { name } of tables) {
//                 await this.db.schema.dropTable(name)
//             }

//             return { success: true }
//         } catch (error) {
//             return { 
//                 success: false, 
//                 error: error instanceof Error ? error.message : String(error) 
//             }
//         }
//     }
// }
