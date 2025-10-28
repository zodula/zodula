import { Database, type DatabaseSchemaName } from "../database/database";
import { DatabaseHelper } from "../database/database";
import { logger } from "../logger";
import { loader } from "../loader";
import type { BunQL } from "bunql";
import { FieldHelper } from "../field";
import type { FieldType } from "../field/type";

export interface SyncSchemaDiff {
  tables: {
    added: Array<{
      name: string;
      columns: Array<{
        name: string;
        type: string;
        /* notNull: boolean; */ primaryKey: boolean;
      }>;
      uniqueConstraints: Array<{ name: string; columns: string[] }>;
    }>;
    removed: Array<{
      name: string;
      columns: Array<{ name: string; type: string /* notNull?: boolean */ }>;
    }>;
  };
  columns: {
    added: Array<{
      table: string;
      column: string;
      type: string /* notNull?: boolean */;
    }>;
    modified: Array<{
      table: string;
      column: string;
      oldType: string;
      newType: string /* oldNotNull?: boolean; newNotNull?: boolean */;
    }>;
    removed: Array<{
      table: string;
      column: string;
      type: string /* notNull?: boolean */;
    }>;
  };
  uniqueConstraints: {
    added: Array<{ table: string; name: string; columns: string[] }>;
    removed: Array<{ table: string; name: string; columns: string[] }>;
  };
}

export interface OrphanedSchemaElements {
  orphanedTables: Array<{
    name: string;
    columns: Array<{ name: string; type: string /* notNull?: boolean */ }>;
  }>;
  orphanedColumns: Array<{
    table: string;
    column: string;
    type: string;
    /* notNull?: boolean */
  }>;
}

export interface SyncOperation {
  type:
    | "createTable"
    | "dropTable"
    | "addColumn"
    | "removeColumn"
    | "modifyColumn"
    | "addUniqueConstraint"
    | "removeUniqueConstraint";
  data: any;
}

export class SyncMigrator {
  // Configuration to toggle NOT NULL constraint handling
  // Set to true to enable NOT NULL constraints, false to allow all fields to be nullable
  // When false, all fields will be created as nullable and NOT NULL constraints will be ignored
  private readonly handleNotNullConstraints: boolean = false;

  /**
   * Compare current database schema with doctype definitions and return the differences
   */
  async compare(
    currentSchema: DatabaseSchemaName,
    applyDestructive: boolean = false
  ): Promise<SyncSchemaDiff> {
    const currentDb = Database(currentSchema);

    // Get all doctype definitions
    const doctypes = loader.from("doctype").list();
    const doctypeNames = new Set(doctypes.map((d) => d.name as string));
    // Get current database tables
    const currentTables = await this.getTables(currentDb);
    const currentTableNames = currentTables
      .filter((t) => !t.name.startsWith("_"))
      .map((t) => t.name);

    const diff: SyncSchemaDiff = {
      tables: {
        added: [],
        removed: [],
      },
      columns: {
        added: [],
        modified: [],
        removed: [],
      },
      uniqueConstraints: {
        added: [],
        removed: [],
      },
    };

    // Find table differences
    const currentTableSet = new Set(currentTableNames);

    // Tables that should exist according to doctypes but don't exist in current database
    for (const doctype of doctypes) {
      if (!currentTableSet.has(doctype.name)) {
        const columns = await this.getTableColumnsFromDoctype(doctype);
        const uniqueConstraints = await this.getUniqueConstraintsFromDoctype(
          doctype.name
        );

        diff.tables.added.push({
          name: doctype.name,
          columns: columns,
          uniqueConstraints: uniqueConstraints,
        });
      }
    }

    // Tables that exist in current database but don't have doctype definitions (only when destructive operations are enabled)
    if (applyDestructive) {
      for (const tableName of currentTableNames) {
        if (!doctypeNames.has(tableName)) {
          const currentTable = currentTables.find((t) => t.name === tableName);
          if (currentTable) {
            diff.tables.removed.push({
              name: tableName,
              columns: currentTable.columns,
            });
          }
        }
      }
    }

    // Compare columns in common tables
    for (const currentTable of currentTables) {
      const doctype = doctypes.find((d) => d.name === currentTable.name);
      if (doctype) {
        await this.compareTableColumnsWithDoctype(
          currentTable,
          doctype,
          diff,
          applyDestructive
        );
        await this.compareTableUniqueConstraintsWithDoctype(
          currentTable,
          doctype,
          diff,
          currentDb,
          applyDestructive
        );
      }
    }

    // Database connection will be closed automatically
    return diff;
  }

  /**
   * Apply the changes to the target schema
   */
  async apply(
    targetSchema: DatabaseSchemaName,
    diff: SyncSchemaDiff,
    applyDestructive: boolean = false
  ): Promise<void> {
    const targetDb = Database(targetSchema);
    // Generate operations from the diff
    const operations = this.generateOperationsFromDiff(diff);

    // Execute all operations
    for (const operation of operations) {
      await this.executeOperation(targetDb, operation);
    }

    // Database connection will be closed automatically
  }

  /**
   * Generate operations from schema diff
   */
  private generateOperationsFromDiff(diff: SyncSchemaDiff): SyncOperation[] {
    const operations: SyncOperation[] = [];

    // Table additions
    for (const table of diff.tables.added) {
      operations.push({
        type: "createTable",
        data: {
          tableName: table.name,
          columns: table.columns,
          uniqueConstraints: table.uniqueConstraints,
        },
      });
    }

    // Table removals (destructive)
    for (const table of diff.tables.removed) {
      operations.push({
        type: "dropTable",
        data: {
          tableName: table.name,
        },
      });
    }

    // Column modifications
    for (const column of diff.columns.modified) {
      operations.push({
        type: "modifyColumn",
        data: column,
      });
    }

    // Column additions
    for (const column of diff.columns.added) {
      operations.push({
        type: "addColumn",
        data: column,
      });
    }

    // Column removals (destructive)
    for (const column of diff.columns.removed) {
      operations.push({
        type: "removeColumn",
        data: column,
      });
    }

    // Unique constraint additions
    for (const constraint of diff.uniqueConstraints.added) {
      operations.push({
        type: "addUniqueConstraint",
        data: constraint,
      });
    }

    // Unique constraint removals (destructive)
    for (const constraint of diff.uniqueConstraints.removed) {
      operations.push({
        type: "removeUniqueConstraint",
        data: constraint,
      });
    }

    return operations;
  }

  /**
   * Execute an operation on the target database
   */
  private async executeOperation(
    targetDb: BunQL,
    operation: SyncOperation
  ): Promise<void> {
    switch (operation.type) {
      case "createTable":
        await this.createTable(
          targetDb,
          operation.data.tableName,
          operation.data.columns,
          operation.data.uniqueConstraints
        );
        break;
      case "dropTable":
        await this.dropTable(targetDb, operation.data.tableName);
        break;
      case "addColumn":
        await this.addColumn(targetDb, operation.data);
        break;
      case "removeColumn":
        await this.removeColumn(targetDb, operation.data);
        break;
      case "modifyColumn":
        await this.modifyColumn(targetDb, operation.data);
        break;
      case "addUniqueConstraint":
        await this.addUniqueConstraint(targetDb, operation.data);
        break;
      case "removeUniqueConstraint":
        await this.removeUniqueConstraint(targetDb, operation.data);
        break;
    }
  }

  /**
   * Create a table in target database
   */
  private async createTable(
    targetDb: BunQL,
    tableName: string,
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      primaryKey: boolean;
    }>,
    uniqueConstraints: Array<{ name: string; columns: string[] }>
  ): Promise<void> {
    try {
      // Create table using bunely schema builder
      const createTableBuilder = targetDb.schema.createTable(tableName);

      // Add columns
      for (const column of columns) {
        createTableBuilder.addColumn({
          name: column.name,
          type: column.type as any,
          notNull: this.handleNotNullConstraints ? column.notNull : false, // Use toggle for NOT NULL constraints
          primaryKey: column.primaryKey,
          unique: false, // We'll handle unique constraints separately
        });
      }

      // Execute table creation
      await createTableBuilder.execute();

      // Add unique constraints after table creation
      for (const constraint of uniqueConstraints) {
        const constraintName = `idx_${tableName}_${constraint.columns.join("_")}_unique`;
        const columnsStr = constraint.columns.map((c) => `"${c}"`).join(", ");
        await targetDb.run(
          `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (${columnsStr})`
        );
      }

      logger.info(`Created table: ${tableName}`);
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
    }
  }

  /**
   * Add a column to an existing table
   */
  private async addColumn(targetDb: BunQL, column: any): Promise<void> {
    try {
      let sql = `ALTER TABLE "${column.table}" ADD COLUMN "${column.column}" ${column.type}`;

      if (this.handleNotNullConstraints && column.notNull) {
        sql += " NOT NULL";
      }

      await targetDb.run(sql);
      logger.info(`Added column: ${column.table}.${column.column}`);
    } catch (error) {
      console.error(
        `Error adding column ${column.table}.${column.column}:`,
        error
      );
    }
  }

  /**
   * Modify a column
   */
  private async modifyColumn(targetDb: BunQL, column: any): Promise<void> {
    try {
      logger.info(`Modifying column: ${column.table}.${column.column}`);

      // PostgreSQL requires explicit casting when changing column types
      // We need to handle different type conversions properly
      const oldType = column.oldType.toLowerCase();
      const newType = column.newType.toUpperCase();

      let sql = `ALTER TABLE "${column.table}" ALTER COLUMN "${column.column}" TYPE ${newType}`;

      // Add USING clause for type conversions that need explicit casting
      if (this.needsExplicitCasting(oldType, newType)) {
        sql += ` USING "${column.column}"::${this.getPostgreSQLType(newType)}`;
      }

      if (this.handleNotNullConstraints && column.newNotNull) {
        sql += " NOT NULL";
      }

      await targetDb.run(sql);
      logger.info(`Modified column: ${column.table}.${column.column}`);
    } catch (error) {
      console.error(
        `Error modifying column ${column.table}.${column.column}:`,
        error
      );
    }
  }

  /**
   * Check if a type conversion needs explicit casting
   */
  private needsExplicitCasting(oldType: string, newType: string): boolean {
    // Common conversions that need explicit casting
    const conversionsNeedingCasting = [
      ["text", "integer"],
      ["text", "float"],
      ["text", "boolean"],
      ["varchar", "integer"],
      ["varchar", "float"],
      ["varchar", "boolean"],
      ["character varying", "integer"],
      ["character varying", "float"],
      ["character varying", "boolean"],
      ["boolean", "integer"],
      ["integer", "boolean"],
      ["float", "integer"],
      ["integer", "float"],
    ];

    return conversionsNeedingCasting.some(
      ([from, to]) =>
        from &&
        to &&
        oldType.includes(from) &&
        newType.toLowerCase().includes(to)
    );
  }

  /**
   * Get PostgreSQL type name for casting
   */
  private getPostgreSQLType(doctypeType: string): string {
    const typeMap: Record<string, string> = {
      TEXT: "text",
      INTEGER: "integer",
      FLOAT: "numeric",
      BOOLEAN: "boolean",
    };

    return typeMap[doctypeType] || doctypeType.toLowerCase();
  }

  /**
   * Add a unique constraint to a table
   */
  private async addUniqueConstraint(
    targetDb: BunQL,
    constraint: any
  ): Promise<void> {
    try {
      const constraintName = `idx_${constraint.table}_${constraint.columns.join("_")}_unique`;
      const columnsStr = constraint.columns
        .map((c: string) => `"${c}"`)
        .join(", ");
      await targetDb.run(
        `ALTER TABLE "${constraint.table}" ADD CONSTRAINT "${constraintName}" UNIQUE (${columnsStr})`
      );
      logger.info(
        `Added unique constraint: ${constraint.table} on columns: ${constraint.columns.join(", ")}`
      );
    } catch (error) {
      console.error(
        `Error adding unique constraint ${constraint.table}.${constraint.name}:`,
        error
      );
    }
  }

  /**
   * Drop a table from the target database
   */
  private async dropTable(targetDb: BunQL, tableName: string): Promise<void> {
    try {
      await targetDb.run(`DROP TABLE IF EXISTS "${tableName}"`);
      logger.info(`Dropped table: ${tableName}`);
    } catch (error) {
      console.error(`Error dropping table ${tableName}:`, error);
    }
  }

  /**
   * Remove a column from an existing table
   */
  private async removeColumn(targetDb: BunQL, column: any): Promise<void> {
    try {
      // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
      // This is a simplified implementation - in practice, you might want to use a more sophisticated approach
      await targetDb.run(
        `ALTER TABLE "${column.table}" DROP COLUMN "${column.column}"`
      );
      logger.info(`Removed column: ${column.table}.${column.column}`);
    } catch (error) {
      console.error(
        `Error removing column ${column.table}.${column.column}:`,
        error
      );
    }
  }

  /**
   * Remove a unique constraint from a table
   */
  private async removeUniqueConstraint(
    targetDb: BunQL,
    constraint: any
  ): Promise<void> {
    try {
      // Find the constraint name for the unique constraint
      const result = await targetDb.all(
        `
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                    AND tc.table_name = ?
                    AND tc.constraint_type = 'UNIQUE'
                GROUP BY tc.constraint_name
                HAVING array_agg(kcu.column_name ORDER BY kcu.ordinal_position) = ?
            `,
        [constraint.table, `{${constraint.columns.join(",")}}`]
      );

      if (result.length > 0) {
        const constraintName = (result[0] as any).constraint_name;
        await targetDb.run(
          `ALTER TABLE "${constraint.table}" DROP CONSTRAINT "${constraintName}"`
        );
        logger.info(
          `Removed unique constraint: ${constraint.table} on columns: ${constraint.columns.join(", ")}`
        );
      }
    } catch (error) {
      console.error(
        `Error removing unique constraint ${constraint.table}.${constraint.name}:`,
        error
      );
    }
  }

  /**
   * Get all tables from a database
   */
  private async getTables(db: BunQL): Promise<
    Array<{
      name: string;
      columns: Array<{ name: string; type: string /* notNull?: boolean */ }>;
    }>
  > {
    const tables: Array<{
      name: string;
      columns: Array<{ name: string; type: string /* notNull?: boolean */ }>;
    }> = [];

    try {
      const tableNames = (await db.all(`
                SELECT table_name as name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                AND table_name NOT LIKE 'pg_%'
            `)) as { name: string }[];

      for (const { name } of tableNames) {
        const tableInfo = await db.schema.getTableInfo(name);
        tables.push({
          name,
          columns: tableInfo.columns,
        });
      }

      return tables;
    } catch (error) {
      console.error("Error getting tables:", error);
      return tables;
    }
  }

  /**
   * Compare columns between current database table and doctype definition
   */
  private async compareTableColumnsWithDoctype(
    currentTable: any,
    doctype: any,
    diff: SyncSchemaDiff,
    applyDestructive: boolean = false
  ): Promise<void> {
    const currentColumns = new Map(
      currentTable.columns.map((c: any) => [c.name, c])
    );

    // Get expected columns from doctype
    const expectedColumns = await this.getTableColumnsFromDoctype(doctype);
    const expectedColumnsMap = new Map(expectedColumns.map((c) => [c.name, c]));

    // Find added columns (in doctype but not in current database)
    for (const [name, column] of expectedColumnsMap) {
      if (!currentColumns.has(name)) {
        diff.columns.added.push({
          table: currentTable.name,
          column: name as string,
          type: (column as any).type,
          // notNull: (column as any).notNull
        });
      }
    }

    // Find removed columns (in current database but not in doctype) - only when destructive operations are enabled
    if (applyDestructive) {
      for (const [name, currentColumn] of currentColumns) {
        if (!expectedColumnsMap.has(name as string)) {
          diff.columns.removed.push({
            table: currentTable.name,
            column: name as string,
            type: (currentColumn as any).type,
            // notNull: (currentColumn as any).notNull
          });
        }
      }
    }

    // Find modified columns (type changed or notNull constraint changed)
    for (const [name, currentColumn] of currentColumns) {
      const expectedColumn = expectedColumnsMap.get(name as string);
      if (expectedColumn) {
        // const currentNotNull = (currentColumn as any).notNull || false
        // const expectedNotNull = (expectedColumn as any).notNull || false

        // Normalize PostgreSQL types for comparison
        const currentType = this.normalizePostgreSQLType(
          (currentColumn as any).type
        );
        const expectedType = (expectedColumn as any).type;

        const typeChanged = currentType !== expectedType;
        // const notNullChanged = currentNotNull !== expectedNotNull

        // Debug logging for type comparison
        if (typeChanged) {
          console.log(
            `Type mismatch for ${currentTable.name}.${name as string}:`
          );
          console.log(
            `  Current (PostgreSQL): ${(currentColumn as any).type} -> Normalized: ${currentType}`
          );
          console.log(`  Expected (Doctype): ${expectedType}`);
        }

        if (typeChanged /* || notNullChanged */) {
          diff.columns.modified.push({
            table: currentTable.name,
            column: name as string,
            oldType: (currentColumn as any).type,
            newType: expectedType,
            // oldNotNull: currentNotNull,
            // newNotNull: expectedNotNull
          });
        }
      }
    }
  }

  /**
   * Compare unique constraints between current database table and doctype definition
   */
  private async compareTableUniqueConstraintsWithDoctype(
    currentTable: any,
    doctype: any,
    diff: SyncSchemaDiff,
    currentDb: BunQL,
    applyDestructive: boolean = false
  ): Promise<void> {
    // Get constraints from doctype definitions (expected schema)
    const expectedConstraints = await this.getUniqueConstraintsFromDoctype(
      currentTable.name
    );

    // Get constraints that actually exist in the current database
    const currentConstraints = await this.getUniqueConstraintsFromDatabase(
      currentDb,
      currentTable.name
    );

    // Create maps using column combinations as keys instead of names
    const currentConstraintMap = new Map(
      currentConstraints.map((c) => [c.columns.join(","), c])
    );
    const expectedConstraintMap = new Map(
      expectedConstraints.map((c) => [c.columns.join(","), c])
    );

    // Find added constraints (in doctype but not in current database)
    for (const [columnsKey, constraint] of expectedConstraintMap) {
      if (!currentConstraintMap.has(columnsKey)) {
        diff.uniqueConstraints.added.push({
          table: currentTable.name,
          name: constraint.name,
          columns: constraint.columns,
        });
      }
    }

    // Find removed constraints (in current database but not in doctype) - only when destructive operations are enabled
    if (applyDestructive) {
      for (const [columnsKey, constraint] of currentConstraintMap) {
        if (!expectedConstraintMap.has(columnsKey)) {
          diff.uniqueConstraints.removed.push({
            table: currentTable.name,
            name: constraint.name,
            columns: constraint.columns,
          });
        }
      }
    }
  }

  /**
   * Get doctype by name
   */
  private async getDoctypeByName(tableName: string): Promise<any> {
    try {
      const doctypes = loader.from("doctype").list();
      return doctypes.find((d) => d.name === tableName);
    } catch (error) {
      console.error(`Error getting doctype for table ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Get table columns from doctype definition
   */
  private async getTableColumnsFromDoctype(
    doctype: any
  ): Promise<
    Array<{ name: string; type: string; notNull: boolean; primaryKey: boolean }>
  > {
    try {
      const columns: Array<{
        name: string;
        type: string;
        notNull: boolean;
        primaryKey: boolean;
      }> = [];
      const fields = doctype.schema.fields;

      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const field = fieldDef as any;
        const sqlType = this.getSQLType(field.type);

        // Skip fields that don't have a SQL representation (NULL type)
        if (sqlType === "NULL") {
          continue;
        }

        columns.push({
          name: fieldName,
          type: sqlType,
          notNull: this.handleNotNullConstraints
            ? field.required || false
            : false, // Use toggle for NOT NULL constraints
          primaryKey: field.primaryKey || false,
        });
      }

      return columns;
    } catch (error) {
      console.error(
        `Error getting columns for doctype ${doctype.name}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get unique constraints that actually exist in the database
   */
  private async getUniqueConstraintsFromDatabase(
    db: BunQL,
    tableName: string
  ): Promise<Array<{ name: string; columns: string[] }>> {
    try {
      // Query PostgreSQL system tables to get unique constraints
      const result = await db.all(
        `
                SELECT 
                    tc.constraint_name as name,
                    array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_schema = 'public'
                    AND tc.table_name = ?
                    AND tc.constraint_type = 'UNIQUE'
                GROUP BY tc.constraint_name
            `,
        [tableName]
      );

      const constraints: Array<{ name: string; columns: string[] }> = [];

      for (const row of result) {
        // Parse PostgreSQL array string to JavaScript array
        let columns: string[] = [];
        const columnsStr = (row as any).columns;

        if (typeof columnsStr === "string") {
          // PostgreSQL array format: "{value1,value2,value3}"
          // Remove curly braces and split by comma
          columns = columnsStr
            .replace(/^{|}$/g, "")
            .split(",")
            .map((col) => col.trim());
        } else if (Array.isArray(columnsStr)) {
          // If it's already an array, use it directly
          columns = columnsStr;
        }

        constraints.push({
          name: (row as any).name,
          columns: columns,
        });
      }

      return constraints;
    } catch (error) {
      console.error(
        `Error getting unique constraints from database for table ${tableName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get unique constraints for a table based on doctype definition
   */
  private async getUniqueConstraintsFromDoctype(
    tableName: string
  ): Promise<Array<{ name: string; columns: string[] }>> {
    try {
      // Get the doctype definition
      const doctypes = loader.from("doctype").list();
      const doctype = doctypes.find((d) => d.name === tableName);

      if (!doctype) {
        return [];
      }

      const constraints: Array<{ name: string; columns: string[] }> = [];
      const fields = doctype.schema.fields;

      // Group fields by their group parameter for unique constraints
      const uniqueGroups = new Map<string, string[]>();
      const individualUniqueFields: string[] = [];

      // Process fields to find unique constraints
      for (const [fieldName, fieldDef] of Object.entries(fields)) {
        const field = fieldDef as any;

        if (field.unique) {
          if (field.group) {
            // Add to group
            if (!uniqueGroups.has(field.group)) {
              uniqueGroups.set(field.group, []);
            }
            uniqueGroups.get(field.group)!.push(fieldName);
          } else {
            // Individual unique field
            individualUniqueFields.push(fieldName);
          }
        }
      }

      // Add individual unique constraints
      for (const fieldName of individualUniqueFields) {
        const constraint = {
          name: `idx_${tableName}_${fieldName}_unique`,
          columns: [fieldName],
        };
        constraints.push(constraint);
      }

      // Add grouped unique constraints
      for (const [groupName, fieldNames] of uniqueGroups) {
        const constraint = {
          name: `idx_${tableName}_${groupName}_unique`,
          columns: fieldNames,
        };
        constraints.push(constraint);
      }

      return constraints;
    } catch (error) {
      console.error(
        `Error getting unique constraints for table ${tableName}:`,
        error
      );
      return [];
    }
  }

  /**
   * Sort tables by dependency order
   */
  private sortTablesByDependency(doctypes: any[]): any[] {
    const sorted: any[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (doctype: any) => {
      if (visiting.has(doctype.name)) {
        return;
      }
      if (visited.has(doctype.name)) {
        return;
      }

      visiting.add(doctype.name);

      // Find dependencies (tables this doctype references)
      const dependencies = this.getTableDependencies(doctype);
      for (const depName of dependencies) {
        const depDoctype = doctypes.find((d) => d.name === depName);
        if (depDoctype) {
          visit(depDoctype);
        }
      }

      visiting.delete(doctype.name);
      visited.add(doctype.name);
      sorted.push(doctype);
    };

    for (const doctype of doctypes) {
      visit(doctype);
    }

    return sorted;
  }

  /**
   * Get table dependencies
   */
  private getTableDependencies(doctype: any): string[] {
    const dependencies: string[] = [];
    const fields = doctype.schema.fields;

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const field = fieldDef as any;
      if (field.type === "Reference" && field.reference) {
        dependencies.push(field.reference);
      }
    }

    return dependencies;
  }

  /**
   * Create a table from doctype definition
   */
  private async createTableFromDoctype(db: BunQL, doctype: any): Promise<void> {
    const tableName = doctype.name;
    const fields = doctype.schema.fields;

    // Create table using bunely schema builder
    const createTableBuilder = db.schema.createTable(tableName);

    // Group fields by their group parameter for unique constraints
    const uniqueGroups = new Map<string, string[]>();
    const individualUniqueFields: string[] = [];

    // Add columns with proper constraints
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const field = fieldDef as any;
      const sqlType = this.getSQLType(field.type);

      // Skip fields that don't have a SQL representation (NULL type)
      if (sqlType === "NULL") {
        continue;
      }

      // Handle unique constraints - group by group parameter
      if (field.unique) {
        if (field.group) {
          // Add to group
          if (!uniqueGroups.has(field.group)) {
            uniqueGroups.set(field.group, []);
          }
          uniqueGroups.get(field.group)!.push(fieldName);
        } else {
          // Individual unique field
          individualUniqueFields.push(fieldName);
        }
      }

      createTableBuilder.addColumn({
        name: fieldName,
        type: sqlType as any,
        notNull: this.handleNotNullConstraints
          ? field.required || false
          : false, // Use toggle for NOT NULL constraints
        primaryKey: field.primaryKey || false,
        unique: false, // We'll handle unique constraints separately
      });
    }

    // Execute table creation
    await createTableBuilder.execute();

    // Add individual unique constraints
    for (const fieldName of individualUniqueFields) {
      const constraintName = `idx_${tableName}_${fieldName}_unique`;
      await db.run(
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE ("${fieldName}")`
      );
    }

    // Add grouped unique constraints
    for (const [groupName, fieldNames] of uniqueGroups) {
      const constraintName = `idx_${tableName}_${groupName}_unique`;
      const columnsStr = fieldNames.map((f) => `"${f}"`).join(", ");
      await db.run(
        `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraintName}" UNIQUE (${columnsStr})`
      );
    }
  }

  /**
   * Convert Zodula field type to SQL type
   */
  private getSQLType(fieldType: FieldType): string {
    return FieldHelper.getSQLiteType(fieldType);
  }

  /**
   * Normalize PostgreSQL type names to match doctype definitions
   */
  private normalizePostgreSQLType(postgresType: string): string {
    const typeMap: Record<string, string> = {
      // Text types
      text: "TEXT",
      "character varying": "TEXT",
      varchar: "TEXT",
      char: "TEXT",

      // Numeric types
      integer: "INTEGER",
      int4: "INTEGER",
      int8: "INTEGER",
      bigint: "INTEGER",
      smallint: "INTEGER",
      real: "FLOAT",
      float4: "FLOAT",
      float8: "FLOAT",
      "double precision": "FLOAT",
      numeric: "FLOAT",
      decimal: "FLOAT",

      // Boolean types
      boolean: "BOOLEAN",
      bool: "BOOLEAN",

      // Date/Time types (stored as TEXT in doctypes)
      timestamp: "TEXT",
      "timestamp with time zone": "TEXT",
      "timestamp without time zone": "TEXT",
      date: "TEXT",
      time: "TEXT",
      "time with time zone": "TEXT",
      "time without time zone": "TEXT",

      // JSON types
      json: "TEXT",
      jsonb: "TEXT",

      // UUID types
      uuid: "TEXT",

      // Other common types
      bytea: "TEXT",
      inet: "TEXT",
      cidr: "TEXT",
      macaddr: "TEXT",
    };

    // Convert to lowercase for case-insensitive matching
    const normalizedType = postgresType.toLowerCase();

    // Return mapped type or original if no mapping found
    return typeMap[normalizedType] || postgresType.toUpperCase();
  }

  /**
   * Detect orphaned tables and columns that exist in database but not in doctype definitions
   */
  async detectOrphanedElements(
    schema: DatabaseSchemaName
  ): Promise<OrphanedSchemaElements> {
    const db = Database(schema);
    const doctypes = loader.from("doctype").list();
    const doctypeNames = new Set(doctypes.map((d) => d.name as string));

    const orphanedElements: OrphanedSchemaElements = {
      orphanedTables: [],
      orphanedColumns: [],
    };

    try {
      // Get all tables from the database
      const dbTables = await this.getTables(db);
      // Find orphaned tables (exist in DB but not in doctypes)
      for (const table of dbTables) {
        if (!table.name.startsWith("_") && !doctypeNames.has(table.name)) {
          orphanedElements.orphanedTables.push({
            name: table.name,
            columns: table.columns,
          });
        }
      }

      // Find orphaned columns (exist in DB but not in doctype definitions)
      for (const table of dbTables) {
        if (!table.name.startsWith("_") && doctypeNames.has(table.name)) {
          const doctype = doctypes.find((d) => d.name === table.name);
          if (doctype) {
            const doctypeFields = new Set(Object.keys(doctype.schema.fields));
            for (const column of table.columns) {
              if (!doctypeFields.has(column.name)) {
                orphanedElements.orphanedColumns.push({
                  table: table.name,
                  column: column.name,
                  type: column.type,
                  // notNull: column.notNull
                });
              }
            }
          }
        }
      }

      return orphanedElements;
    } catch (error) {
      console.error("Error detecting orphaned elements:", error);
      return orphanedElements;
    } finally {
      // Database connection will be closed automatically
    }
  }

  /**
   * Make all existing columns nullable by removing NOT NULL constraints
   *
   * Usage example:
   * ```typescript
   * const migrator = new SyncMigrator();
   * await migrator.makeAllColumnsNullable('your_database_name');
   * ```
   */
  async makeAllColumnsNullable(schema: DatabaseSchemaName): Promise<void> {
    const db = Database(schema);

    try {
      logger.info("🔄 Making all columns nullable...");

      // Get all tables from the database
      const tables = await this.getTables(db);

      for (const table of tables) {
        if (table.name.startsWith("_")) {
          continue; // Skip system tables
        }

        logger.info(`Processing table: ${table.name}`);

        // Check if table has any NOT NULL columns (excluding primary keys)
        const hasNotNullColumns = await this.hasNotNullColumns(db, table.name);

        if (hasNotNullColumns) {
          logger.info(
            `  Table ${table.name} has NOT NULL columns, recreating...`
          );
          await this.makeTableColumnsNullable(db, table.name);
        } else {
          logger.info(`  Table ${table.name} already has nullable columns`);
        }
      }

      logger.success("✅ All columns are now nullable");
    } catch (error) {
      logger.error("Error making columns nullable:", error);
      throw error;
    } finally {
      // Database connection will be closed automatically
    }
  }

  /**
   * Check if a table has any NOT NULL columns (excluding primary keys)
   */
  private async hasNotNullColumns(
    db: BunQL,
    tableName: string
  ): Promise<boolean> {
    try {
      const result = await db.all(
        `
                SELECT COUNT(*) as count 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                    AND table_name = $1
                    AND is_nullable = 'NO'
                    AND column_name NOT IN (
                        SELECT column_name 
                        FROM information_schema.key_column_usage 
                        WHERE table_schema = 'public'
                            AND table_name = $1
                            AND constraint_name IN (
                                SELECT constraint_name 
                                FROM information_schema.table_constraints 
                                WHERE table_schema = 'public'
                                    AND table_name = $1
                                    AND constraint_type = 'PRIMARY KEY'
                            )
                    )
            `,
        [tableName]
      );

      return (result[0] as any).count > 0;
    } catch (error) {
      logger.warn(
        `Could not check NOT NULL columns for table ${tableName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Make all columns in a table nullable by recreating the table
   */
  private async makeTableColumnsNullable(
    db: BunQL,
    tableName: string
  ): Promise<void> {
    try {
      // Get the current table schema
      const tableInfo = await db.schema.getTableInfo(tableName);

      // Create a new table with the same structure but without NOT NULL constraints
      const newTableName = `${tableName}_temp_nullable`;

      // Create new table without NOT NULL constraints
      const createTableBuilder = db.schema.createTable(newTableName);

      for (const column of tableInfo.columns) {
        createTableBuilder.addColumn({
          name: column.name,
          type: column.type as any,
          notNull: false, // Always allow NULL
          primaryKey: column.primaryKey || false,
          unique: false,
        });
      }

      await createTableBuilder.execute();

      // Copy data from old table to new table
      await db.run(
        `INSERT INTO "${newTableName}" SELECT * FROM "${tableName}"`
      );

      // Drop old table
      await db.run(`DROP TABLE "${tableName}"`);

      // Rename new table to original name
      await db.run(`ALTER TABLE "${newTableName}" RENAME TO "${tableName}"`);

      logger.info(
        `  Successfully made all columns nullable in table: ${tableName}`
      );
    } catch (error) {
      logger.error(
        `  Error making table columns nullable ${tableName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Make a specific column nullable by recreating the table
   */
  private async makeColumnNullable(
    db: BunQL,
    tableName: string,
    columnName: string
  ): Promise<void> {
    try {
      // Get the current table schema
      const tableInfo = await db.schema.getTableInfo(tableName);

      // Create a new table with the same structure but without NOT NULL constraints
      const newTableName = `${tableName}_temp_nullable`;

      // Create new table without NOT NULL constraints
      const createTableBuilder = db.schema.createTable(newTableName);

      for (const column of tableInfo.columns) {
        createTableBuilder.addColumn({
          name: column.name,
          type: column.type as any,
          notNull: false, // Always allow NULL
          primaryKey: column.primaryKey || false,
          unique: false,
        });
      }

      await createTableBuilder.execute();

      // Copy data from old table to new table
      await db.run(
        `INSERT INTO "${newTableName}" SELECT * FROM "${tableName}"`
      );

      // Drop old table
      await db.run(`DROP TABLE "${tableName}"`);

      // Rename new table to original name
      await db.run(`ALTER TABLE "${newTableName}" RENAME TO "${tableName}"`);

      logger.info(
        `  Successfully made column nullable: ${tableName}.${columnName}`
      );
    } catch (error) {
      logger.error(
        `  Error making column nullable ${tableName}.${columnName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Log warnings for orphaned database elements
   */
  logOrphanedWarnings(orphaned: OrphanedSchemaElements): void {
    if (orphaned.orphanedTables.length > 0) {
      const tableNames = orphaned.orphanedTables.map((t) => t.name).join(", ");
      logger.warn(
        `⚠️  Orphaned tables: ${tableNames} (${orphaned.orphanedTables.length} total)`
      );
      logger.warn(
        `   → Create doctype definitions or remove these tables from database`
      );
    }

    if (orphaned.orphanedColumns.length > 0) {
      const columnDetails = orphaned.orphanedColumns
        .map((c) => `${c.table}.${c.column}`)
        .join(", ");
      logger.warn(
        `⚠️  Orphaned columns: ${columnDetails} (${orphaned.orphanedColumns.length} total)`
      );
      logger.warn(
        `   → Add field definitions or remove these columns from database`
      );
    }

    if (
      orphaned.orphanedTables.length === 0 &&
      orphaned.orphanedColumns.length === 0
    ) {
      logger.success("✅ Database schema is fully synchronized");
    }
  }
}
