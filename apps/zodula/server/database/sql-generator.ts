// import type { 
//     SQLTypeWithoutNULL, 
//     ColumnsDefinition, 
//     ConstraintDefinition 
// } from "./types"

// /**
//  * SQL Generator for creating migration code strings
//  */
// export class SQLGenerator {
//     /**
//      * Generate add column SQL code
//      */
//     addColumn(tableName: string, columnName: string, type: SQLTypeWithoutNULL): string {
//         return `await sql.addColumn("${tableName}", "${columnName}", "${type}")`
//     }

//     /**
//      * Generate create table SQL code
//      */
//     createTable(tableName: string, columns: ColumnsDefinition): string {
//         const columnDefs = Object.entries(columns)
//             .map(([name, def]) => {
//                 let sql = `"${name}" ${def.type}`
//                 if (def.notNull) sql += " NOT NULL"
//                 return sql
//             })
//             .join(", ")

//         return `await sql.createTable("${tableName}", {\n${Object.entries(columns)
//             .map(([name, def]) => `        ${name}: { type: "${def.type}"${def.notNull ? ", notNull: true" : ""} }`)
//             .join(",\n")}\n    })`
//     }

//     /**
//      * Generate drop table SQL code
//      */
//     dropTable(tableName: string): string {
//         return `await sql.dropTable("${tableName}")`
//     }

//     /**
//      * Generate add unique constraint SQL code
//      */
//     addUnique(tableName: string, columns: string[]): string {
//         return `await sql.addUnique("${tableName}", [${columns.map(c => `"${c}"`).join(", ")}])`
//     }

//     /**
//      * Generate add index SQL code
//      */
//     addIndex(tableName: string, columns: string[]): string {
//         return `await sql.addIndex("${tableName}", [${columns.map(c => `"${c}"`).join(", ")}])`
//     }

//     /**
//      * Generate add foreign key SQL code
//      */
//     addForeignKey(
//         tableName: string, 
//         columns: string[], 
//         references: { table: string; columns: string[] },
//         onDelete?: string,
//         onUpdate?: string
//     ): string {
//         const refStr = `{ table: "${references.table}", columns: [${references.columns.map(c => `"${c}"`).join(", ")}] }`
//         const options = []
//         if (onDelete) options.push(`onDelete: "${onDelete}"`)
//         if (onUpdate) options.push(`onUpdate: "${onUpdate}"`)
//         const optionsStr = options.length > 0 ? `, ${options.join(", ")}` : ""
        
//         return `await sql.addForeignKey("${tableName}", [${columns.map(c => `"${c}"`).join(", ")}], ${refStr}${optionsStr})`
//     }
// }
