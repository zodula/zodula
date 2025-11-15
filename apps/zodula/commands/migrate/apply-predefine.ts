import { loader } from "../../server/loader";
import path from "path";
import { $ } from "bun";
import type { Bunely } from "bunely";
import { logger } from "../../server/logger";
import type {
  DoctypeMetadata,
  DoctypeRelative,
} from "../../server/loader/plugins/doctype";
import { Database } from "@/zodula/server/database";

// Types for better type safety
interface ProcessedEntities {
  doctypes: string[];
  fields: string[];
  relatives: string[];
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
  doc_status: 0;
} {
  const timestamp = createTimestamp();
  return {
    owner: null,
    created_by: null,
    updated_by: null,
    created_at: timestamp,
    updated_at: timestamp,
    doc_status: 0,
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
  const fieldPayloads: Required<Zodula.SelectDoctype<"zodula__Field">>[] = [];
  const fieldIds: string[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(fields)) {
    const id = `${doctypeName}--${fieldName}`;
    fieldIds.push(id);

    const fieldPayload = {
      id,
      type: fieldSchema.type,
      required: fieldSchema.required ? 1 : 0,
      name: fieldName,
      doctype: doctypeName,
      label: fieldSchema.label || fieldName || null,
      description: fieldSchema.description || null,
      options: fieldSchema.options || null,
      filters: fieldSchema.filters || null,
      default: fieldSchema.default || null,
      plain: fieldSchema.plain ? 1 : 0,
      reference: fieldSchema.reference || null,
      reference_type: fieldSchema.reference_type || null,
      reference_alias: fieldSchema.reference_alias || null,
      reference_label: fieldSchema.reference_label || null,
      below_field: fieldSchema.below_field || null,
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
      on_delete: fieldSchema.on_delete || null,
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
      currency_symbol: fieldSchema.currency_symbol || null,
      hidden: fieldSchema.hidden ? 1 : 0,
      only_db: fieldSchema.only_db ? 1 : 0,
      width: fieldSchema.width || null,
      fetch_from: fieldSchema.fetch_from || null,
      fetch_field: fieldSchema.fetch_field || null,
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"zodula__Field">>;

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
      .from("zodula__Field")
      .where("id", "IN", fieldIds)
      .execute();

    const existingIds = new Set(existingFields.map((f) => f.id));

    // Separate payloads for insert vs update
    const insertPayloads: Required<Zodula.SelectDoctype<"zodula__Field">>[] =
      [];
    const updatePayloads: Required<Zodula.SelectDoctype<"zodula__Field">>[] =
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
      await trx.insert("zodula__Field").values(insertPayloads).execute();
    }

    // Batch update existing fields
    if (updatePayloads.length > 0) {
      for (const payload of updatePayloads) {
        await trx
          .update("zodula__Field")
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
    Zodula.SelectDoctype<"zodula__Doctype Relative">
  >[] = [];
  const relativeIds: string[] = [];

  for (const relativeItem of relatives) {
    const newId = `${relativeItem.parentDoctype}--${relativeItem.childDoctype}--${relativeItem.childFieldName}`;
    relativeIds.push(newId);

    const relativePayload = {
      id: newId,
      parent_doctype: relativeItem.parentDoctype,
      child_doctype: relativeItem.childDoctype,
      child_field_name: relativeItem.childFieldName,
      alias: relativeItem.alias,
      type: relativeItem.type,
      reference_label: relativeItem.reference_label || null,
      below_field: relativeItem.below_field || null,
      idx: relativeIdx++,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"zodula__Doctype Relative">>;

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
      .from("zodula__Doctype Relative")
      .where("id", "IN", relativeIds)
      .execute();

    const existingIds = new Set(existingRelatives.map((r) => r.id));

    // Separate payloads for insert vs update
    const insertPayloads: Required<
      Zodula.SelectDoctype<"zodula__Doctype Relative">
    >[] = [];
    const updatePayloads: Required<
      Zodula.SelectDoctype<"zodula__Doctype Relative">
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
        .insert("zodula__Doctype Relative")
        .values(insertPayloads)
        .execute();
    }

    // Batch update existing relatives
    if (updatePayloads.length > 0) {
      for (const payload of updatePayloads) {
        await trx
          .update("zodula__Doctype Relative")
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

async function processRelatives(
  trx: Bunely,
  doctype: DoctypeMetadata,
  startIdx: number
): Promise<{ processedRelativeIds: string[] }> {
  return await upsertRelativesBatch(trx, doctype.relatives, startIdx);
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
      name: app.packageName,
      version: appVersion,
      description: app.package.description || null,
      idx,
      vector: "[]",
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"zodula__App">>;

    const isExist = await trx
      .select("*")
      .from("zodula__App")
      .where("name", "=", app.packageName)
      .first();

    if (isExist) {
      await trx
        .update("zodula__App")
        .set(appPayload)
        .where("name", "=", app.packageName)
        .execute();
    } else {
      await trx.insert("zodula__App").values(appPayload).execute();
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
async function cleanupOrphanedEntities(
  trx: Bunely,
  processedEntities: ProcessedEntities
): Promise<void> {
  try {
    // Remove orphaned doctypes
    if (processedEntities.doctypes.length > 0) {
      await trx
        .delete("zodula__Doctype")
        .where("id", "NOT IN", processedEntities.doctypes)
        .execute();
    }

    // Remove orphaned fields
    if (processedEntities.fields.length > 0) {
      await trx
        .delete("zodula__Field")
        .where("id", "NOT IN", processedEntities.fields)
        .execute();
    }

    // Remove orphaned relatives
    if (processedEntities.relatives.length > 0) {
      await trx
        .delete("zodula__Doctype Relative")
        .where("id", "NOT IN", processedEntities.relatives)
        .execute();
    }

    // Remove orphaned apps
    if (processedEntities.apps.length > 0) {
      await trx
        .delete("zodula__App")
        .where("name", "NOT IN", processedEntities.apps)
        .execute();
    }
  } catch (error) {
    console.error("Failed to cleanup orphaned entities:", error);
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
      require_user_permission: doctype.config.require_user_permission ? 1 : 0,
      tabs: doctype.config.tabs || null,
      idx,
      vector: "[]",
      comments_enabled: doctype.config.comments_enabled ? 1 : 0,
      only_fixtures: doctype.config.only_fixtures ? 1 : 0,
      is_child_doctype: doctype.config.is_child_doctype ? 1 : 0,
      ...basePayload,
    } satisfies Required<Zodula.SelectDoctype<"zodula__Doctype">>;

    const isExist = await trx
      .select("*")
      .from("zodula__Doctype")
      .where("id", "=", doctype.name)
      .first();

    if (isExist) {
      await trx
        .update("zodula__Doctype")
        .set(doctypePayload)
        .where("id", "=", doctype.name)
        .execute();
    } else {
      await trx.insert("zodula__Doctype").values(doctypePayload).execute();
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to upsert doctype ${doctype.name}: ${error}`,
    };
  }
}

export const applyPredefine = async (): Promise<void> => {
  try {
    const trx = Database("main");
    const doctypes = loader.from("doctype").list();
    const processedEntities: ProcessedEntities = {
      doctypes: [],
      fields: [],
      relatives: [],
      apps: [],
    };

    let doctypeIdx = 0;
    let fieldIdx = 0;
    let relativeIdx = 0;

    // Process all doctypes
    for (const doctype of doctypes) {
      try {
        // Process doctype
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

        // Process fields and relatives in parallel for this doctype
        const [fieldResults, relativeResults] = await Promise.all([
          processFields(trx, doctype, fieldIdx),
          processRelatives(trx, doctype, relativeIdx),
        ]);

        processedEntities.fields.push(...fieldResults.processedFieldIds);
        fieldIdx += fieldResults.processedFieldIds.length;

        processedEntities.relatives.push(
          ...relativeResults.processedRelativeIds
        );
        relativeIdx += relativeResults.processedRelativeIds.length;
      } catch (error) {
        console.error(`Error processing doctype ${doctype.name}:`, error);
        // Continue with next doctype
      }
    }

    // Process apps
    try {
      logger.info(`Applying apps predefined`);
      const appResults = await processApps(trx);
      processedEntities.apps.push(...appResults.processedAppNames);
    } catch (error) {
      console.error("Error processing apps:", error);
    }

    // Clean up orphaned entities
    try {
      logger.info("Cleaning up orphaned entities...");
      await cleanupOrphanedEntities(trx, processedEntities);
    } catch (error) {
      logger.error("Error during cleanup:", error);
      throw error; // Re-throw cleanup errors as they're critical
    }

    logger.info(
      `Processed: ${processedEntities.doctypes.length} doctypes, ${processedEntities.fields.length} fields, ${processedEntities.relatives.length} relatives, ${processedEntities.apps.length} apps`
    );
  } catch (error) {
    console.error("Critical error in applyPredefine:", error);
    throw error;
  }
};
