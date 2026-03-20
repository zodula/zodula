import { loader } from "../../server/loader";
import path from "path";
import { $ } from "bun";
import type { Bunely } from "bunely";
import { logger } from "../../server/logger";
import type {
  DoctypeMetadata,
  DoctypeRelative,
  DoctypeChild,
} from "../../server/loader/plugins/doctype";
import { Database } from "@/zodula/server/database";

// Types for better type safety
interface ProcessedEntities {
  doctypes: string[];
  fields: string[];
  relatives: string[];
  children: string[];
  apps: string[];
}

interface UpsertResult {
  success: boolean;
  error?: string;
}

interface AppInfo {
  packageName: string;
  package: {
    description?: string;
  };
}

// Utility functions
async function getAppVersion(appName: string): Promise<string> {
  try {
    const app = loader.from("app").get(appName);
    const appDir = path.resolve(app.dir);

    const commitDateTime = (
      await $.cwd(
        appDir
      )`git log -1 --format=%cd --date=format:'%Y-%m-%d-%H%M%S' HEAD`.quiet()
    ).text();
    return commitDateTime || "local";
  } catch (error) {
    return "local";
  }
}

function createTimestamp(): string {
  return $zodula.utils.format(new Date(), "datetime");
}

function createBasePayload(): {
  owner: null;
  created_by: null;
  updated_by: null;
  created_at: string;
  updated_at: string;
  doc_status: "Draft" | "Submitted" | "Cancelled";
} {
  const timestamp = createTimestamp();
  return {
    owner: null,
    created_by: null,
    updated_by: null,
    created_at: timestamp,
    updated_at: timestamp,
    doc_status: "Draft",
  };
}

// Field processing functions
async function upsertFieldsBatch(
  trx: Bunely,
  doctypeName: string,
  fields: Record<string, Zodula.Field>,
  startIdx: number
): Promise<{ processedFieldIds: string[] }> {
  const processedFieldIds: string[] = [];
  const basePayload = createBasePayload();
  let fieldIdx = startIdx;

  // Prepare all field payloads
  const fieldPayloads: Required<Zodula.SelectDoctype<"Field">>[] = [];
  const fieldIds: string[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(fields)) {
    const id = `${doctypeName}--${fieldName}`;
    fieldIds.push(id);

    const fieldPayload = {
      id,
      parentid: null,
      parentype: null,
      parentfield: null,
      type: fieldSchema.type,
      required: fieldSchema.required ? 1 : 0,
      name: fieldName,
      doctype: doctypeName,
      label: fieldSchema.label || fieldName || null,
      description: fieldSchema.description || null,
      options: fieldSchema.options || null,
      filters: fieldSchema.filters || null,
      sort: fieldSchema.sort || null,
      order: fieldSchema.order || null,
      default: fieldSchema.default || null,
      plain: fieldSchema.plain ? 1 : 0,
      reference: fieldSchema.reference || null,
      is_auto_generated: fieldSchema.is_auto_generated ? 1 : 0,
      unique: fieldSchema.unique ? 1 : 0,
      group: fieldSchema.group || null,
      readonly: fieldSchema.readonly ? 1 : 0,
      only_create: fieldSchema.only_create ? 1 : 0,
      allow_on_submit: fieldSchema.allow_on_submit ? 1 : 0,
      in_list_view: fieldSchema.in_list_view ? 1 : 0,
      no_copy: fieldSchema.no_copy ? 1 : 0,
      no_print: fieldSchema.no_print ? 1 : 0,
      accept: fieldSchema.accept || null,
      min_length: fieldSchema.min_length || null,
      length: fieldSchema.length || null,
      min: fieldSchema.min || null,
      max: fieldSchema.max || null,
      depends_on: fieldSchema.depends_on || null,
      required_on: fieldSchema.required_on || null,
      readonly_on: fieldSchema.readonly_on || null,
      is_public: fieldSchema.is_public ? 1 : 0,
      idx: fieldIdx++,
      vector: "[]",
      hidden: fieldSchema.hidden ? 1 : 0,
      only_db: fieldSchema.only_db ? 1 : 0,
      width: fieldSchema.width || null,
      fetch_from: fieldSchema.fetch_from || null,
      in_quick_entry: fieldSchema.in_quick_entry ? 1 : 0 || null,
      perm_level: fieldSchema.perm_level || "0",
      only_once: fieldSchema.only_once ? 1 : 0 || null,
      no_translate: fieldSchema.no_translate ? 1 : 0 || null,
      is_quick_filter: fieldSchema.is_quick_filter ? 1 : 0 || null,
      in_tree_view: fieldSchema.in_tree_view ? 1 : 0 || null,
      height: fieldSchema.height || null,
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"Field">>;

    fieldPayloads.push(fieldPayload);
  }

  try {
    // Handle empty fields array
    if (fieldIds.length === 0) {
      return { processedFieldIds: [] };
    }

    // Check which fields already exist
    const existingFields = await trx
      .select("id")
      .from("Field")
      .where("id", "IN", fieldIds)
      .execute();

    const existingIds = new Set(existingFields.map((f) => f.id));

    // Separate payloads for insert vs update
    const insertPayloads: Required<Zodula.SelectDoctype<"Field">>[] =
      [];
    const updatePayloads: Required<Zodula.SelectDoctype<"Field">>[] =
      [];

    for (const payload of fieldPayloads) {
      if (existingIds.has(payload.id)) {
        updatePayloads.push(payload);
      } else {
        insertPayloads.push(payload);
      }
    }

    // Batch insert new fields
    if (insertPayloads.length > 0) {
      await trx.insert("Field").values(insertPayloads).execute();
    }

    // Batch update existing fields
    if (updatePayloads.length > 0) {
      for (const payload of updatePayloads) {
        await trx
          .update("Field")
          .set(payload)
          .where("id", "=", payload.id)
          .execute();
      }
    }

    processedFieldIds.push(...fieldIds);
    return { processedFieldIds };
  } catch (error) {
    console.error(`Failed to batch upsert fields for ${doctypeName}:`, error);
    return { processedFieldIds: [] };
  }
}

async function processFields(
  trx: Bunely,
  doctype: DoctypeMetadata,
  startIdx: number
): Promise<{ processedFieldIds: string[] }> {
  return await upsertFieldsBatch(
    trx,
    doctype.name,
    doctype.schema.fields,
    startIdx
  );
}

// Relative processing functions
async function upsertRelativesBatch(
  trx: Bunely,
  relatives: DoctypeRelative[],
  startIdx: number
): Promise<{ processedRelativeIds: string[] }> {
  const processedRelativeIds: string[] = [];
  const basePayload = createBasePayload();
  let relativeIdx = startIdx;

  // Prepare all relative payloads
  const relativePayloads: Required<
    Zodula.SelectDoctype<"Doctype Relative">
  >[] = [];
  const relativeIds: string[] = [];

  for (const relativeItem of relatives) {
    const newId = `${relativeItem.parentDoctype}--${relativeItem.childDoctype}--${relativeItem.childFieldName}`;
    relativeIds.push(newId);

    const relativePayload = {
      id: newId,
      parentid: null,
      parentype: null,
      parentfield: null,
      parent_doctype: relativeItem.parentDoctype,
      child_doctype: relativeItem.childDoctype,
      child_field_name: relativeItem.childFieldName,
      idx: relativeIdx++,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"Doctype Relative">>;

    relativePayloads.push(relativePayload);
  }

  try {
    // Handle empty relatives array
    if (relativeIds.length === 0) {
      return { processedRelativeIds: [] };
    }

    // Check which relatives already exist
    const existingRelatives = await trx
      .select("id")
      .from("Doctype Relative")
      .where("id", "IN", relativeIds)
      .execute();

    const existingIds = new Set(existingRelatives.map((r) => r.id));

    // Separate payloads for insert vs update
    const insertPayloads: Required<
      Zodula.SelectDoctype<"Doctype Relative">
    >[] = [];
    const updatePayloads: Required<
      Zodula.SelectDoctype<"Doctype Relative">
    >[] = [];

    for (const payload of relativePayloads) {
      if (existingIds.has(payload.id)) {
        updatePayloads.push(payload);
      } else {
        insertPayloads.push(payload);
      }
    }

    // Batch insert new relatives
    if (insertPayloads.length > 0) {
      await trx
        .insert("Doctype Relative")
        .values(insertPayloads)
        .execute();
    }

    // Batch update existing relatives
    if (updatePayloads.length > 0) {
      for (const payload of updatePayloads) {
        await trx
          .update("Doctype Relative")
          .set(payload)
          .where("id", "=", payload.id)
          .execute();
      }
    }

    processedRelativeIds.push(...relativeIds);
    return { processedRelativeIds };
  } catch (error) {
    console.error(`Failed to batch upsert relatives:`, error);
    return { processedRelativeIds: [] };
  }
}

// Children processing functions
async function upsertChildrenBatch(
  trx: Bunely,
  children: DoctypeChild[],
  startIdx: number
): Promise<{ processedChildIds: string[] }> {
  const processedChildIds: string[] = [];
  const basePayload = createBasePayload();
  let childIdx = startIdx;

  // Prepare all child payloads
  const childPayloads: Required<
    Zodula.SelectDoctype<"Doctype Children">
  >[] = [];
  const childIds: string[] = [];

  for (const childItem of children) {
    const newId = `${childItem.parentDoctype}--${childItem.childDoctype}--${childItem.parentFieldName}`;
    childIds.push(newId);

    const childPayload = {
      id: newId,
      parentid: null,
      parentype: null,
      parentfield: null,
      child_doctype: childItem.childDoctype,
      parent_doctype: childItem.parentDoctype,
      parent_field_name: childItem.parentFieldName,
      type: childItem.type,
      idx: childIdx++,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"Doctype Children">>;

    childPayloads.push(childPayload);
  }

  try {
    // Handle empty children array
    if (childIds.length === 0) {
      return { processedChildIds: [] };
    }

    // Check which children already exist
    const existingChildren = await trx
      .select("id")
      .from("Doctype Children")
      .where("id", "IN", childIds)
      .execute();

    const existingIds = new Set(existingChildren.map((c) => c.id));

    // Separate payloads for insert vs update
    const insertPayloads: Required<
      Zodula.SelectDoctype<"Doctype Children">
    >[] = [];
    const updatePayloads: Required<
      Zodula.SelectDoctype<"Doctype Children">
    >[] = [];

    for (const payload of childPayloads) {
      if (existingIds.has(payload.id)) {
        updatePayloads.push(payload);
      } else {
        insertPayloads.push(payload);
      }
    }

    // Batch insert new children
    if (insertPayloads.length > 0) {
      await trx
        .insert("Doctype Children")
        .values(insertPayloads)
        .execute();
    }

    // Batch update existing children
    if (updatePayloads.length > 0) {
      for (const payload of updatePayloads) {
        await trx
          .update("Doctype Children")
          .set(payload)
          .where("id", "=", payload.id)
          .execute();
      }
    }

    processedChildIds.push(...childIds);
    return { processedChildIds };
  } catch (error) {
    console.error(`Failed to batch upsert children:`, error);
    return { processedChildIds: [] };
  }
}

async function processRelatives(
  trx: Bunely,
  doctype: DoctypeMetadata,
  startIdx: number
): Promise<{ processedRelativeIds: string[] }> {
  return await upsertRelativesBatch(trx, doctype.relatives, startIdx);
}

async function processChildren(
  trx: Bunely,
  doctype: DoctypeMetadata,
  startIdx: number
): Promise<{ processedChildIds: string[] }> {
  return await upsertChildrenBatch(trx, doctype.children, startIdx);
}

// App processing functions
async function upsertApp(
  trx: Bunely,
  app: AppInfo,
  idx: number
): Promise<UpsertResult> {
  try {
    const appVersion = await getAppVersion(app.packageName);
    const basePayload = createBasePayload();
    const appPayload = {
      id: app.packageName,
      parentid: null,
      parentype: null,
      parentfield: null,
      name: app.packageName,
      version: appVersion,
      description: app.package.description || null,
      idx,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"App">>;

    const isExist = await trx
      .select("*")
      .from("App")
      .where("name", "=", app.packageName)
      .first();

    if (isExist) {
      await trx
        .update("App")
        .set(appPayload)
        .where("name", "=", app.packageName)
        .execute();
    } else {
      await trx.insert("App").values(appPayload).execute();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to upsert app ${app.packageName}: ${error}`,
    };
  }
}

async function processApps(
  trx: Bunely
): Promise<{ processedAppNames: string[] }> {
  const apps = loader.from("app").list();
  const processedAppNames: string[] = [];
  let appIdx = 0;

  for (const app of apps) {
    const appResult = await upsertApp(trx, app, appIdx);
    if (appResult.success) {
      processedAppNames.push(app.packageName);
    } else {
      console.error(appResult.error);
    }
    appIdx++;
  }

  return { processedAppNames };
}

// Cleanup functions

/**
 * Full global cleanup — removes every row whose ID is not in the processed set.
 * Used at the end of a full (all-doctype) apply-predefined run.
 */
async function cleanupOrphanedEntities(
  trx: Bunely,
  processedEntities: ProcessedEntities
): Promise<void> {
  try {
    // Remove orphaned doctypes
    if (processedEntities.doctypes.length > 0) {
      await trx
        .delete("Doctype")
        .where("id", "NOT IN", processedEntities.doctypes)
        .execute();
    }

    // Remove orphaned fields
    if (processedEntities.fields.length > 0) {
      await trx
        .delete("Field")
        .where("id", "NOT IN", processedEntities.fields)
        .execute();
    }

    // Remove orphaned relatives
    if (processedEntities.relatives.length > 0) {
      await trx
        .delete("Doctype Relative")
        .where("id", "NOT IN", processedEntities.relatives)
        .execute();
    }

    // Remove orphaned children
    if (processedEntities.children.length > 0) {
      await trx
        .delete("Doctype Children")
        .where("id", "NOT IN", processedEntities.children)
        .execute();
    }

    // Remove orphaned apps
    if (processedEntities.apps.length > 0) {
      await trx
        .delete("App")
        .where("name", "NOT IN", processedEntities.apps)
        .execute();
    }
  } catch (error) {
    console.error("Failed to cleanup orphaned entities:", error);
    throw error;
  }
}

/**
 * Scoped cleanup — only removes stale rows for the specific doctypes that were
 * just reloaded.  Safe to call during HMR because it never touches rows that
 * belong to other doctypes.
 */
async function cleanupScopedDoctypeEntities(
  trx: Bunely,
  doctypeNames: string[],
  processedFieldIds: string[],
  processedRelativeIds: string[],
  processedChildIds: string[]
): Promise<void> {
  try {
    for (const doctypeName of doctypeNames) {
      // Fields: remove any field of this doctype that is no longer defined
      if (processedFieldIds.length > 0) {
        await trx
          .delete("Field")
          .where("doctype", "=", doctypeName)
          .where("id", "NOT IN", processedFieldIds)
          .execute();
      } else {
        // Doctype now has no fields — delete all its field rows
        await trx.delete("Field").where("doctype", "=", doctypeName).execute();
      }

      // Relatives: remove stale entries where this doctype is the parent
      if (processedRelativeIds.length > 0) {
        await trx
          .delete("Doctype Relative")
          .where("parent_doctype", "=", doctypeName)
          .where("id", "NOT IN", processedRelativeIds)
          .execute();
      } else {
        await trx
          .delete("Doctype Relative")
          .where("parent_doctype", "=", doctypeName)
          .execute();
      }

      // Children: remove stale entries where this doctype is the parent
      if (processedChildIds.length > 0) {
        await trx
          .delete("Doctype Children")
          .where("parent_doctype", "=", doctypeName)
          .where("id", "NOT IN", processedChildIds)
          .execute();
      } else {
        await trx
          .delete("Doctype Children")
          .where("parent_doctype", "=", doctypeName)
          .execute();
      }
    }
  } catch (error) {
    console.error("Failed to cleanup scoped doctype entities:", error);
    throw error;
  }
}

// Doctype processing functions
async function upsertDoctype(
  trx: Bunely,
  doctype: DoctypeMetadata,
  idx: number
): Promise<UpsertResult> {
  try {
    const basePayload = createBasePayload();
    const doctypePayload = {
      id: doctype.name,
      parentid: null,
      parentype: null,
      parentfield: null,
      name: doctype.name,
      label: doctype.config.label || doctype.name || null,
      json_model: JSON.stringify(doctype.schema, null, 2),
      app: doctype.appName,
      is_single: doctype.config.is_single ? 1 : 0,
      naming_series: doctype.config.naming_series || null,
      is_submittable: doctype.config.is_submittable ? 1 : 0,
      track_changes: doctype.config.track_changes ? 1 : 0,
      display_field: doctype.config.display_field || null,
      search_fields: doctype.config.search_fields || null,
      is_system_generated: doctype.config.is_system_generated ? 1 : 0,
      tabs: doctype.config.tabs || null,
      idx,
      vector: "[]",
      comments_enabled: doctype.config.comments_enabled ? 1 : 0,
      only_fixtures: doctype.config.only_fixtures ? 1 : 0,
      is_child_doctype: doctype.config.is_child_doctype ? 1 : 0,
      is_quick_entry: doctype.config.is_quick_entry ? 1 : 0,
      additional_connections: doctype.config.additional_connections || null,
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"Doctype">>;

    const isExist = await trx
      .select("*")
      .from("Doctype")
      .where("id", "=", doctype.name)
      .first();

    if (isExist) {
      await trx
        .update("Doctype")
        .set(doctypePayload)
        .where("id", "=", doctype.name)
        .execute();
    } else {
      await trx.insert("Doctype").values(doctypePayload).execute();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to upsert doctype ${doctype.name}: ${error}`,
    };
  }
}

/**
 * Apply predefined metadata to the database.
 *
 * @param doctypeNames  When provided, only the listed doctypes are processed
 *                      and cleanup is scoped to those doctypes only (safe for
 *                      HMR hot-reloads).  When omitted, all doctypes and apps
 *                      are processed with a full global orphan cleanup.
 *
 * This function is meant to be called through `loader.applyPredefined()` —
 * do not import and call it directly.
 */
export const applyPredefined = async (doctypeNames?: string[]): Promise<void> => {
  const isScoped = doctypeNames !== undefined;
  try {
    const trx = Database("main");
    const allDoctypes = loader.from("doctype").list();
    const doctypes = isScoped
      ? allDoctypes.filter((d) => doctypeNames.includes(d.name))
      : allDoctypes;

    const processedEntities: ProcessedEntities = {
      doctypes: [],
      fields: [],
      relatives: [],
      children: [],
      apps: [],
    };

    let doctypeIdx = 0;
    let fieldIdx = 0;
    let relativeIdx = 0;
    let childIdx = 0;

    // Process doctypes (all or scoped subset)
    for (const doctype of doctypes) {
      try {
        const doctypeResult = await upsertDoctype(trx, doctype, doctypeIdx);
        if (!doctypeResult.success) {
          console.error(
            `Failed to process doctype ${doctype.name}:`,
            doctypeResult.error
          );
          continue;
        }
        processedEntities.doctypes.push(doctype.name);
        doctypeIdx++;

        // Process fields, relatives, and children in parallel for this doctype
        const [fieldResults, relativeResults, childResults] = await Promise.all([
          processFields(trx, doctype, fieldIdx),
          processRelatives(trx, doctype, relativeIdx),
          processChildren(trx, doctype, childIdx),
        ]);

        processedEntities.fields.push(...fieldResults.processedFieldIds);
        fieldIdx += fieldResults.processedFieldIds.length;

        processedEntities.relatives.push(...relativeResults.processedRelativeIds);
        relativeIdx += relativeResults.processedRelativeIds.length;

        processedEntities.children.push(...childResults.processedChildIds);
        childIdx += childResults.processedChildIds.length;
      } catch (error) {
        console.error(`Error processing doctype ${doctype.name}:`, error);
      }
    }

    if (isScoped) {
      // Scoped run: only clean up rows belonging to the changed doctypes
      await cleanupScopedDoctypeEntities(
        trx,
        doctypeNames,
        processedEntities.fields,
        processedEntities.relatives,
        processedEntities.children
      );
    } else {
      // Full run: process apps and perform global orphan cleanup
      try {
        logger.info(`Applying apps predefined`);
        const appResults = await processApps(trx);
        processedEntities.apps.push(...appResults.processedAppNames);
      } catch (error) {
        console.error("Error processing apps:", error);
      }

      try {
        logger.info("Cleaning up orphaned entities...");
        await cleanupOrphanedEntities(trx, processedEntities);
      } catch (error) {
        logger.error("Error during cleanup:", error);
        throw error;
      }
    }

    logger.info(
      `Processed: ${processedEntities.doctypes.length} doctypes, ${processedEntities.fields.length} fields, ${processedEntities.relatives.length} relatives, ${processedEntities.children.length} children, ${processedEntities.apps.length} apps`
    );
  } catch (error) {
    console.error("Critical error in applyPredefined:", error);
    throw error;
  }
};
