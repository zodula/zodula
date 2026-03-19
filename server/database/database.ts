import path, { dirname } from "path";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
} from "fs";
import { dbcontext } from "../async-context";
import { createFileDatabase, type Bunely } from "bunely";
export type DatabaseSchemaName =
  | "main"
  | "__temp__apply_migration"
  | "__temp__push"
  | "test"
  | "test_source"
  | "test_target";

function resolveSchemaName(schemaName: string) {
  // Allow remapping schema names via environment variables.
  // Example: set `ZODULA_DB_MAIN=test` so `Database("main")` uses the `test` DB.
  const envKey = `ZODULA_DB_${schemaName.toUpperCase()}`;
  const override = process.env[envKey];
  return override ? override : schemaName;
}

export function Database(schemaName: string): Bunely {
  const resolvedSchema = resolveSchemaName(schemaName);

  const db_dir = path.join(
    process.cwd(),
    ".zodula_data",
    "database",
    resolvedSchema
  );
  if (
    !existsSync(
      path.join(process.cwd(), ".zodula_data", "database", resolvedSchema)
    )
  ) {
    mkdirSync(
      path.join(process.cwd(), ".zodula_data", "database", resolvedSchema),
      { recursive: true }
    );
  }
  if (dbcontext.getStore()?.trx) {
    return dbcontext.getStore()?.trx as Bunely;
  } else {
    const db_path = path.join(db_dir, `${resolvedSchema}.db`);
    const db = createFileDatabase(db_path);
    db.run(`PRAGMA journal_mode = WAL`);
    db.run(`PRAGMA foreign_keys = ON`);
    db.run(`PRAGMA synchronous = NORMAL`);
    return db;
  }
}
export class DatabaseHelper {
  static deleteDatabase(schemaName: string) {
    const resolvedSchema = resolveSchemaName(schemaName);
    const db_dir = path.join(
      process.cwd(),
      ".zodula_data",
      "database",
      resolvedSchema
    );
    if (!existsSync(db_dir)) return;

    // Delete all sqlite artifacts: <name>.db, <name>.db-wal, <name>.db-shm, etc.
    // This avoids ENOTEMPTY when WAL/SHM files still exist.
    const files = readdirSync(db_dir).filter((f) => f.startsWith(`${resolvedSchema}.db`));
    for (const file of files) {
      const full = path.join(db_dir, file);
      if (existsSync(full)) {
        unlinkSync(full);
      }
    }

    // Best-effort cleanup of remaining files (if any)
    // (e.g. previously created temp artifacts).
    const remainingFiles = readdirSync(db_dir);
    for (const file of remainingFiles) {
      const full = path.join(db_dir, file);
      if (existsSync(full)) {
        try {
          unlinkSync(full);
        } catch {
          // Ignore directories; rmdirSync will fail if not empty.
        }
      }
    }

    if (existsSync(db_dir)) {
      try {
        rmdirSync(db_dir);
      } catch {
        // Ignore if directory still not empty; next migration run will be able
        // to reuse/overwrite DB files.
      }
    }
  }
}
