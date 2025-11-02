import path, { dirname } from "path";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
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

export function Database(schemaName: string): Bunely {
  const db_dir = path.join(
    process.cwd(),
    ".zodula_data",
    "database",
    schemaName
  );
  if (
    !existsSync(
      path.join(process.cwd(), ".zodula_data", "database", schemaName)
    )
  ) {
    mkdirSync(
      path.join(process.cwd(), ".zodula_data", "database", schemaName),
      { recursive: true }
    );
  }
  if (dbcontext.getStore()?.trx) {
    return dbcontext.getStore()?.trx as Bunely;
  } else {
    const db_path = path.join(db_dir, `${schemaName}.db`);
    const db = createFileDatabase(db_path);
    db.run(`PRAGMA journal_mode = WAL`);
    db.run(`PRAGMA foreign_keys = ON`);
    db.run(`PRAGMA synchronous = NORMAL`);
    return db;
  }
}
export class DatabaseHelper {
  static deleteDatabase(schemaName: string) {
    const db_dir = path.join(
      process.cwd(),
      ".zodula_data",
      "database",
      schemaName
    );
    const db_path = path.join(db_dir, `${schemaName}.db`);
    if (existsSync(db_path)) {
      unlinkSync(db_path);
    }
    if (existsSync(db_dir)) {
      rmdirSync(db_dir);
    }
  }
}
