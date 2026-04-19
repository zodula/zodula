import { Database } from "@/zodula/server/database";
import { loader } from "@/zodula/server/loader";
import { logger } from "@/zodula/server/logger";
import path from "path";
import { globalContext } from "@/zodula/server/async-context";
import type { Bunely } from "bunely";

type ChildRef = {
  parentFieldName: string;
  childDoctype: string;
};

const FIXTURES_STORE_TABLE = "fixtures_store";

const getChildRefs = (doctype: string): ChildRef[] => {
  try {
    const meta = loader.from("doctype").get(doctype as Zodula.DoctypeName) as {
      children?: Array<{
        parentDoctype?: string;
        parentFieldName?: string;
        childDoctype?: string;
      }>;
    };
    return (meta.children || [])
      .filter(
        (c) =>
          c.parentDoctype === doctype &&
          !!c.parentFieldName &&
          !!c.childDoctype
      )
      .map((c) => ({
        parentFieldName: c.parentFieldName as string,
        childDoctype: c.childDoctype as string,
      }));
  } catch {
    return [];
  }
};

function quoteIdent(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function ensureFixturesStoreTable(db: Bunely) {
  db.run(
    `CREATE TABLE IF NOT EXISTS ${quoteIdent(FIXTURES_STORE_TABLE)} (
      doctype TEXT NOT NULL,
      id TEXT NOT NULL,
      PRIMARY KEY (doctype, id)
    )`
  );
}

function clearFixturesStore(db: Bunely) {
  db.run(`DELETE FROM ${quoteIdent(FIXTURES_STORE_TABLE)}`);
}

function recordFixtureStoreId(db: Bunely, doctype: string, id: string) {
  db.run(
    `INSERT OR REPLACE INTO ${quoteIdent(FIXTURES_STORE_TABLE)} (doctype, id) VALUES (?, ?)`,
    [doctype, id]
  );
}

function tableHasColumn(
  db: Bunely,
  tableName: string,
  columnName: string
): boolean {
  const cols = db.all(
    `PRAGMA table_info(${quoteIdent(tableName)})`
  ) as Array<{ name: string }>;
  return cols.some((c) => c.name === columnName);
}

/**
 * After all fixtures are applied: remove rows with created_by IS NULL that are not
 * listed in fixtures_store for that doctype. Child tables are processed before parents.
 */
function cleanupNullCreatedByNotInFixturesStore(
  db: Bunely,
  doctypesToScan: Set<string>
) {
  const list = [...doctypesToScan];
  const withParentId = list.filter((dt) => tableHasColumn(db, dt, "parentid"));
  const withoutParentId = list.filter((dt) => !withParentId.includes(dt));
  const ordered = [...withParentId, ...withoutParentId];

  for (const dt of ordered) {
    if (!tableHasColumn(db, dt, "created_by")) continue;

    const result = db.run(
      `DELETE FROM ${quoteIdent(dt)}
       WHERE ${quoteIdent("created_by")} IS NULL
       AND id NOT IN (SELECT id FROM ${quoteIdent(FIXTURES_STORE_TABLE)} WHERE doctype = ?)`,
      [dt]
    );
    const changes = (result as { changes?: number })?.changes ?? 0;
    if (changes > 0) {
      logger.info(
        `Removed ${changes} row(s) with created_by IS NULL not in ${FIXTURES_STORE_TABLE} from ${dt}`
      );
    }
  }
}

export const applyFixtures = async () => {
  try {
    const db = Database("main");
    globalContext.enterWith({
      global: {
        bypass: true,
      },
    });

    ensureFixturesStoreTable(db);
    // Reset so this run only tracks ids from fixtures applied below (avoids stale rows from prior runs).
    clearFixturesStore(db);

    const fixtures = loader.from("fixture").list();
    const count = fixtures.length;
    /** All doctype tables that participate in fixture files (for final cleanup). */
    const doctypesForCleanup = new Set<string>();

    for (const fixture of fixtures) {
      const childRefs = getChildRefs(fixture.name);
      doctypesForCleanup.add(fixture.name);
      for (const cr of childRefs) {
        doctypesForCleanup.add(cr.childDoctype);
      }

      const fixtureData = (await import(path.resolve(fixture.file)))
        ?.default as Zodula.InsertDoctype<Zodula.DoctypeName>[];
      if (!Array.isArray(fixtureData)) {
        throw "Fixture data is not an array";
      }

      const fixtureIds: string[] = [];

      for (const data of fixtureData) {
        if (!data.id) {
          throw new Error("ID is required");
        }
        const parentData = { ...(data as Record<string, any>) };
        const childRowsByField: Record<string, Record<string, any>[]> = {};
        for (const childRef of childRefs) {
          const rows = parentData[childRef.parentFieldName];
          if (Array.isArray(rows)) {
            childRowsByField[childRef.parentFieldName] = rows;
            delete parentData[childRef.parentFieldName];
          }
        }

        fixtureIds.push(data.id);
        recordFixtureStoreId(db, fixture.name, data.id);

        const existing = await db.all(
          `SELECT id FROM ${quoteIdent(fixture.name)} WHERE id = ?`,
          [data.id]
        );
        if (existing.length > 0) {
          await db
            .update(fixture.name as Zodula.DoctypeName)
            .set({
              ...parentData,
              created_at: null,
              updated_at: null,
              id: data?.id,
              doc_status: data?.doc_status || "Draft",
            })
            .where("id", "=", data.id)
            .execute();
        } else {
          await db
            .insert(fixture.name as Zodula.DoctypeName)
            .values({
              ...parentData,
              created_at: null,
              updated_at: null,
              doc_status: data?.doc_status || "Draft",
            })
            .execute();
        }

        for (const childRef of childRefs) {
          if (
            !Object.prototype.hasOwnProperty.call(
              childRowsByField,
              childRef.parentFieldName
            )
          ) {
            continue;
          }
          const childRows = childRowsByField[childRef.parentFieldName] || [];
          await db
            .delete(childRef.childDoctype as Zodula.DoctypeName)
            .where("parentid", "=", data.id)
            .where("parentype", "=", fixture.name)
            .where("parentfield", "=", childRef.parentFieldName)
            .execute();

          if (childRows.length > 0) {
            await db
              .insert(childRef.childDoctype as Zodula.DoctypeName)
              .values(
                childRows.map((row, index) => ({
                  ...row,
                  id: row?.id || `${data.id}-${childRef.parentFieldName}-${index + 1}`,
                  idx: row?.idx ?? index,
                  doc_status: row?.doc_status || "Draft",
                  parentid: data.id,
                  parentype: fixture.name,
                  parentfield: childRef.parentFieldName,
                  created_at: null,
                  updated_at: null,
                }))
              )
              .execute();

            childRows.forEach((row, index) => {
              const childId =
                row?.id ||
                `${data.id}-${childRef.parentFieldName}-${index + 1}`;
              recordFixtureStoreId(db, childRef.childDoctype, childId);
            });
          }
        }
      }

      const doctypeDoc = await db
        .select()
        .from("Doctype")
        .where("id", "=", fixture.name)
        .first();

      if (doctypeDoc && doctypeDoc.only_fixtures === 1) {
        if (fixtureIds.length > 0) {
          await db
            .delete(fixture.name as Zodula.DoctypeName)
            .where("id", "NOT IN", fixtureIds)
            .execute();
          logger.info(
            `Cleaned up records not in fixtures for doctype: ${fixture.name}`
          );
        } else {
          await db.delete(fixture.name as Zodula.DoctypeName).execute();
          logger.info(
            `Removed all records for doctype with only_fixtures: ${fixture.name} (no fixtures)`
          );
        }
      }
    }

    cleanupNullCreatedByNotInFixturesStore(db, doctypesForCleanup);

    logger.info(`Applied ${count} fixtures`);
  } catch (error: any) {
    logger.error(`Error applying fixtures: ${error?.message || error}`);
    throw error?.message || error;
  } finally {
    globalContext.exit(() => { });
  }
};
