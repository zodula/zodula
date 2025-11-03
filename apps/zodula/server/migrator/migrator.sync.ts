import { Database, type DatabaseSchemaName } from "../database/database";
import { DatabaseHelper } from "../database/database";
import { logger } from "../logger";
import { loader } from "../loader";
import type { Bunely } from "bunely";
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
    | "modifyColumn";
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
    };

    // Find table differences
    const currentTableSet = new Set(currentTableNames);

    // Tables that should exist according to doctypes but don't exist in current database
    for (const doctype of doctypes) {
      if (!currentTableSet.has(doctype.name)) {
        const columns = await this.getTableColumnsFromDoctype(doctype);

        diff.tables.added.push({
          name: doctype.name,
          columns: columns,
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


    return operations;
  }

  /**
   * Execute an operation on the target database
   */
  private async executeOperation(
    targetDb: Bunely,
    operation: SyncOperation
  ): Promise<void> {
    switch (operation.type) {
      case "createTable":
        await this.createTable(
          targetDb,
          operation.data.tableName,
          operation.data.columns
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
    }
  }

  /**
   * Create a table in target database
   */
  private async createTable(
    targetDb: Bunely,
    tableName: string,
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      primaryKey: boolean;
    }>
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
          unique: false, // Unique constraints are now validated at application level
        });
      }

      // Execute table creation
      await createTableBuilder.execute();

      logger.info(`Created table: ${tableName}`);
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
    }
  }

  /**
   * Add a column to an existing table
   */
  private async addColumn(targetDb: Bunely, column: any): Promise<void> {
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
  private async modifyColumn(targetDb: Bunely, column: any): Promise<void> {
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
   * Drop a table from the target database
   */
  private async dropTable(targetDb: Bunely, tableName: string): Promise<void> {
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
  private async removeColumn(targetDb: Bunely, column: any): Promise<void> {
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
   * Get all tables from a database
   */
  private async getTables(db: Bunely): Promise<
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
      // SQLite approach: query sqlite_master for table names
      const tableNames = (await db.all(`
                SELECT name 
                FROM sqlite_master 
                WHERE type = 'table' 
                AND name NOT LIKE 'sqlite_%'
            `)) as { name: string }[];

      for (const { name } of tableNames) {
        const columns = await db.schema.getTableInfo(name);
        tables.push({
          name,
          columns: columns,
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
  private async createTableFromDoctype(
    db: Bunely,
    doctype: any
  ): Promise<void> {
    const tableName = doctype.name;
    const fields = doctype.schema.fields;

    // Create table using bunely schema builder
    const createTableBuilder = db.schema.createTable(tableName);

    // Add columns with proper constraints
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const field = fieldDef as any;
      const sqlType = this.getSQLType(field.type);

      // Skip fields that don't have a SQL representation (NULL type)
      if (sqlType === "NULL") {
        continue;
      }

      createTableBuilder.addColumn({
        name: fieldName,
        type: sqlType as any,
        notNull: this.handleNotNullConstraints
          ? field.required || false
          : false, // Use toggle for NOT NULL constraints
        primaryKey: field.primaryKey || false,
        unique: false, // Unique constraints are now validated at application level
      });
    }

    // Execute table creation
    await createTableBuilder.execute();
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
    db: Bunely,
    tableName: string
  ): Promise<boolean> {
    try {
      // SQLite approach: use PRAGMA table_info to get column information
      const columns = (await db.all(
        `PRAGMA table_info("${tableName}")`
      )) as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      // Check if any non-primary-key columns have NOT NULL constraint (notnull = 1)
      return columns.some((col) => col.notnull === 1 && col.pk === 0);
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
    db: Bunely,
    tableName: string
  ): Promise<void> {
    try {
      // Get the current table schema
      const columns = await db.schema.getTableInfo(tableName);

      // Create a new table with the same structure but without NOT NULL constraints
      const newTableName = `${tableName}_temp_nullable`;

      // Create new table without NOT NULL constraints
      const createTableBuilder = db.schema.createTable(newTableName);

      for (const column of columns) {
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
    db: Bunely,
    tableName: string,
    columnName: string
  ): Promise<void> {
    try {
      // Get the current table schema
      const columns = await db.schema.getTableInfo(tableName);

      // Create a new table with the same structure but without NOT NULL constraints
      const newTableName = `${tableName}_temp_nullable`;

      // Create new table without NOT NULL constraints
      const createTableBuilder = db.schema.createTable(newTableName);

      for (const column of columns) {
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
