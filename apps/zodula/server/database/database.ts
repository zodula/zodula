import { dirname } from "path";
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from "fs";
import { dbcontext } from "../async-context";
import { BunQL } from "bunql";
export type DatabaseSchemaName =
  | "main"
  | "__temp__apply_migration"
  | "__temp__push"
  | "test"
  | "test_source"
  | "test_target";

let db: BunQL | null = null;

export function Database(schemaName: string): BunQL {
  if (!!dbcontext.getStore()?.trx) {
    return dbcontext.getStore()?.trx as BunQL;
  } else {
    // Each request gets its own connection
    return new BunQL(process.env.DATABASE_URL!);
  }
}
export class DatabaseHelper {}
