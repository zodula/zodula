import { Database } from "@/zodula/server/database/database";
import { ZodulaSession } from "../session";
import { loader } from "@/zodula/server/loader";
import { naming } from "../naming";
import { ZodulaDoctypeHelper } from "./helper";
import { zodula } from "..";
import type { Bunely } from "bunely";
import path from "path";
import fs from "fs/promises";
import { ErrorWithCode } from "@/zodula/error";
import { getDoctypeConnections } from "../utils";

interface UpdateOptions {
  bypass: boolean;
  override: boolean;
  fields: (keyof Zodula.SelectDoctype<any>)[];
}

interface RelationshipData {
  extendsList: Record<string, any>;
  refTableList: Record<string, any[]>;
}

export class ZodulaDoctypeUpdate<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private doctypeName: TN;
  private session: ZodulaSession = new ZodulaSession();
  private input: Zodula.UpdateDoctype<TN> = {} as Zodula.UpdateDoctype<TN>;
  private options: UpdateOptions = {
    bypass: false,
    override: false,
    fields: [],
  };

  constructor(doctypeName: TN, id: string, input: Zodula.UpdateDoctype<TN>) {
    this.doctypeName = doctypeName;
    this.input = { ...input, id };
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN>)[]) {
    this.options.fields = fields;
    return this;
  }

  private async _update() {
    const db = Database("main");
    const user = await this.session.user(true);
    const doctype = loader.from("doctype").get(this.doctypeName);
    const isGlobal = doctype.config.is_global === 1;

    const old = await zodula
      .doctype(this.doctypeName)
      .get(this.input.id!)
      .bypass(true)
      .unsafe();

    this.input.organization = isGlobal ? "SYS" : old?.organization;

    if (old?.organization !== this.input.organization) {
      throw new ErrorWithCode("Cannot change organization through update api", {
        status: 400,
      });
    }

    this.input.doc_status = this.input.doc_status
      ? +this.input.doc_status!
      : old?.doc_status || 0;
    // Validate document exists and can be updated
    await this.validateDocument(old);

    // Prepare the document data
    let prepared = await this.prepareDocumentData(old, user, doctype);

    // Validate readonly fields
    ZodulaDoctypeHelper.validateDoc(
      prepared,
      doctype.schema,
      this.options.bypass
    );

    // Get roles once for permission checks
    const roles = await zodula.session.roles();

    // Validate permission level permissions for changed fields
    if (!this.options.bypass) {
      const isOwn = old.owner === user.id;
      await ZodulaDoctypeHelper.validatePermLevelPermissionForUpdate(
        this.doctypeName,
        old,
        prepared,
        roles,
        this.options.bypass,
        isOwn
      );
    }

    // Validate unique constraints (exclude current document)
    await ZodulaDoctypeHelper.validateUniqueFields(
      this.doctypeName,
      prepared,
      doctype.schema,
      this.options.bypass,
      this.input.id // Exclude current document from uniqueness check
    );
    await this.applyFileUpdate(prepared, this.doctypeName, doctype.schema);
    // Check permissions
    const { can } =
      await ZodulaDoctypeHelper.checkPermission(
        this.doctypeName,
        "can_update",
        old,
        {
          bypass: this.options.bypass,
          doctype,
        }
      );

    if (!can) {
      throw new ErrorWithCode(
        `You do not have permission to update ${this.doctypeName} document with id ${this.input.id}`,
        {
          status: 403,
        }
      );
    }
    // Execute the update process
    return await this.executeUpdate(db, doctype, old, prepared);
  }

  private async applyFileUpdate(
    prepared: Zodula.SelectDoctype<TN>,
    doctypeName: Zodula.DoctypeName,
    doctype: Zodula.DoctypeSchema
  ) {
    for (let [key, value] of Object.entries(prepared)) {
      const fieldConfig = doctype.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;

      if (fieldConfig?.type === "File") {
        const doctypeName = this.doctypeName;
        const docId = this.input.id!;
        if (value instanceof File) {
          const fieldName = key;
          const filename = value.name;

          // TODO: write file to .zodula_data/files/<doctypeName>/<docId>/<fieldName>/<filename>
          await fs.mkdir(
            path.join(
              process.cwd(),
              ".zodula_data",
              "files",
              prepared.organization || "SYS",
              doctypeName,
              docId,
              fieldName
            ),
            { recursive: true }
          );
          const fileDir = path.join(
            process.cwd(),
            ".zodula_data",
            "files",
            prepared.organization || "SYS",
            doctypeName,
            docId,
            fieldName,
            filename
          );
          await Bun.write(fileDir, value);
          // delete others
          const files = await fs.readdir(
            path.join(
              process.cwd(),
              ".zodula_data",
              "files",
              prepared.organization || "SYS",
              doctypeName,
              docId,
              fieldName
            )
          );
          for (const file of files) {
            if (file !== filename) {
              await fs.unlink(
                path.join(
                  process.cwd(),
                  ".zodula_data",
                  "files",
                  prepared.organization || "SYS",
                  doctypeName,
                  docId,
                  fieldName,
                  file
                )
              );
            }
          }

          // set value to filename
          (prepared as any)[key] = filename;
        }

        if (!value) {
          const fieldName = key;
          const fileDir = path.join(
            process.cwd(),
            ".zodula_data",
            "files",
            prepared.organization || "SYS",
            doctypeName,
            docId,
            fieldName
          );
          await fs.rmdir(fileDir, { recursive: true }).catch(() => { });
        }

        // if folder have no files, delete it
        const fileDir = path.join(
          process.cwd(),
          ".zodula_data",
          "files",
          prepared.organization || "SYS",
          doctypeName,
          docId
        );
        const files = await fs.readdir(fileDir).catch(() => []);
        if (files.length === 0) {
          await fs.rmdir(fileDir, { recursive: true }).catch(() => { });
        }

        // if doctype folder have no files, delete it
        const doctypeDir = path.join(
          process.cwd(),
          ".zodula_data",
          "files",
          prepared.organization || "SYS",
          doctypeName
        );
        const doctypeFiles = await fs.readdir(doctypeDir).catch(() => []);
        if (doctypeFiles.length === 0) {
          await fs.rmdir(doctypeDir, { recursive: true }).catch(() => { });
        }
      }
    }
  }

  private async validateDocument(old: Zodula.SelectDoctype<TN> | null) {
    if (!old) {
      throw new Error(`Document with id ${this.input.id} not found`, {
        cause: 404,
      });
    }
    if (old.id !== this.input.id) {
      throw new Error(`Must not change id with update api`, {
        cause: 400,
      });
    }
    if (old.doc_status === 2) {
      throw new ErrorWithCode(
        `Cannot update cancelled document. Document with id ${this.input.id} has been cancelled.`,
        { status: 400 }
      );
    }


    // Prevent changing doc_status through update - use submit/cancel methods instead
    if (
      this.input.doc_status !== undefined &&
      this.input.doc_status !== old.doc_status &&
      !this.options.bypass
    ) {
      throw new ErrorWithCode(
        `Cannot change doc_status through update API. Use submit() or cancel() methods instead.`,
        { status: 400 }
      );
    }

    // Validate owner change - only allow if current owner is null or equals current user
    if (this.input.owner !== undefined && this.input.owner !== old.owner) {
      const user = await this.session.user(true);
      if (old.owner !== null && old.owner !== user.id) {
        throw new ErrorWithCode(
          `Cannot change owner. You can only change owner when current owner is null or when you are the current owner.`,
          { status: 400 }
        );
      }
    }
  }

  private async prepareDocumentData(
    old: Zodula.SelectDoctype<TN>,
    user: any,
    doctype: any
  ): Promise<Zodula.SelectDoctype<TN>> {
    let prepared = {
      ...old,
      ...this.input,
      idx: this.input.idx === null ? 0 : this.input.idx,
      updated_by: user.id || null,
      updated_at: zodula.utils.format(new Date(), "datetime"),
    } as Zodula.SelectDoctype<TN>;

    let formatted = { ...prepared };
    ZodulaDoctypeHelper.formatDoc(
      formatted as Zodula.SelectDoctype<TN>,
      doctype.schema
    );
    await ZodulaDoctypeHelper.ensureReferenceDoc(
      doctype.schema,
      formatted as Zodula.SelectDoctype<TN>
    );
    return formatted;
  }

  private async shouldChangeId(
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>,
    db: Bunely
  ): Promise<boolean> {
    const namingSeries = doctype.schema.naming_series;
    if (!namingSeries) {
      return false;
    }

    // Extract field names from naming_series using {{field}} pattern
    // Only check actual field values, not dynamic values like {YYYY}, {MM}, {DD}, etc.
    const fieldRegex = /\{\{(.*?)\}\}/g;
    const fieldMatches = namingSeries.match(fieldRegex) || [];
    const fieldsInNamingSeries = fieldMatches.map((match: string) =>
      match.replaceAll("{{", "").replaceAll("}}", "")
    );

    if (fieldsInNamingSeries.length === 0) {
      return false;
    }

    // Get the old document to compare
    const old = await zodula
      .doctype(this.doctypeName)
      .get(this.input.id!)
      .bypass(true)
      .unsafe();
    if (!old) {
      return false;
    }

    // Check if any field used in naming_series has changed
    // Only regenerate ID if actual field values have changed, not due to dynamic values
    let hasFieldChanges = false;
    for (const fieldName of fieldsInNamingSeries) {
      const oldValue = old[fieldName as keyof Zodula.SelectDoctype<TN>];
      const newValue = prepared[fieldName as keyof Zodula.SelectDoctype<TN>];

      if (oldValue !== newValue) {
        hasFieldChanges = true;
        break;
      }
    }

    // If fields haven't changed, don't regenerate ID (even if dynamic values would produce different ID)
    if (!hasFieldChanges) {
      return false;
    }

    // find relatives and then change id of them
    // const relatives = doctype.relatives.filter((rel: any) => rel.parentDoctype === this.doctypeName);
    const oldId = old?.id
    const newId = await naming(this.doctypeName, prepared as any);

    const children = doctype.children
    for (const child of children) {
      await db.run(`UPDATE "${child.childDoctype}" SET "${child.childFieldName}" = ? WHERE "${child.childFieldName}" = ?`, [newId, oldId]);
    }

    // update connections
    const connections = await getDoctypeConnections(doctype.name, oldId)
    for (const connection of connections) {
      const fieldPath = connection.field
      const fieldParts = fieldPath.split(".")
      if (fieldParts.length > 2) {
        throw new ErrorWithCode(`Invalid field path: ${fieldPath}`, { status: 400 })
      }
      const parentField = fieldParts[0]
      const childField = fieldParts[1]
      let q = zodula.doctype(connection.doctype as any).select().bypass(true)
      for (const filter of connection.filters) {
        q = q.where(filter[0], filter[1] as any, filter[2])
      }
      const results = await q
      for (const result of results.docs) {
        if (!childField) {
          // This is a normal field, so we can update it
          await db.run(`UPDATE "${connection.doctype}" SET ${connection.field} = ? WHERE ${connection.field} = ?`, [newId, oldId]);
        } else {
          // This is a child field, so we need to update the child document
          const parentDoctype = loader.from("doctype").get(connection.doctype as any)
          const parentFieldConfig = parentDoctype.schema.fields[parentField as keyof Zodula.DoctypeSchema] as any
          const childDoctype = parentFieldConfig.reference as Zodula.DoctypeName

          await db.run(`UPDATE "${childDoctype}" SET ${childField} = ? WHERE ${childField} = ?`, [newId, oldId]);
        }
      }
    }

    // update audit trail
    await db.run(`UPDATE 'zodula__Audit Trail' SET doctype_id = ? WHERE doctype_id = ? AND doctype = ?`, [newId, oldId, this.doctypeName]);

    // Fields have changed, so generate new ID based on updated field values

    // Update the prepared document with the new ID
    prepared.id = newId as any;

    await db.run(`UPDATE "${this.doctypeName}" SET id = ? WHERE id = ?`, [newId, this.input.id]);

    // Update the input ID for the rest of the update process
    this.input.id = newId as any;
    return true;
  }

  private async executeUpdate(
    db: any,
    doctype: any,
    old: Zodula.SelectDoctype<TN>,
    prepared: Zodula.SelectDoctype<TN>
  ): Promise<Zodula.SelectDoctype<TN>> {
    // Execute before triggers
    await this.executeBeforeTriggers(old, prepared);

    // Check if id should change and perform rename if needed
    // This must be done before extracting relationship data
    await this.shouldChangeId(doctype, prepared, db as Bunely);

    // Extract relationship data
    const relationshipData = this.extractRelationshipData(doctype, prepared);
    // Update main document
    const result = await this.updateMainDocument(db, doctype, prepared);

    // Update relationships
    await this.updateRelationships(db, doctype, result, relationshipData);

    // Process Vector fields for embeddings if changed
    await this.processVectorFields(old, result, doctype.schema);

    // Create audit trail if user-defined fields have changed
    await this.createAuditTrail(old, result);

    // Execute after triggers
    await this.executeAfterTriggers(old, result);
    const formatted = ZodulaDoctypeHelper.formatDocResult<TN>(
      result,
      doctype.schema
    );
    return formatted;
  }

  private async executeBeforeTriggers(
    old: Zodula.SelectDoctype<TN>,
    prepared: Zodula.SelectDoctype<TN>
  ) {
    const isSaveAfterSubmit =
      old?.doc_status === 1 && prepared.doc_status === 1;
    const isDraft = old?.doc_status === 0;

    if (isSaveAfterSubmit) {
      await loader
        .from("doctype")
        .trigger(this.doctypeName, "before_save_after_submit", {
          old,
          doc: prepared,
          input: this.input,
        });
    }

    if (isDraft) {
      await loader.from("doctype").trigger(this.doctypeName, "before_save", {
        old,
        doc: prepared,
        input: this.input,
      });
    }

    await loader.from("doctype").trigger(this.doctypeName, "before_change", {
      old,
      doc: prepared,
      input: this.input,
    });
  }

  private async executeAfterTriggers(
    old: Zodula.SelectDoctype<TN>,
    result: Zodula.SelectDoctype<TN>
  ) {
    const isSaveAfterSubmit = old?.doc_status === 1 && result.doc_status === 1;
    const isDraft = old?.doc_status === 0;

    if (isSaveAfterSubmit) {
      await loader
        .from("doctype")
        .trigger(this.doctypeName, "after_save_after_submit", {
          old,
          doc: result,
          input: this.input,
        });
    }

    if (isDraft) {
      await loader.from("doctype").trigger(this.doctypeName, "after_save", {
        old,
        doc: result,
        input: this.input,
      });
    }

    await loader.from("doctype").trigger(this.doctypeName, "after_change", {
      old,
      doc: result,
      input: this.input,
    });
  }

  private extractRelationshipData(
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>
  ): RelationshipData {
    const extendsList: Record<string, any> = {};
    const refTableList: Record<string, any[]> = {};

    // Extract extend fields
    for (const [key, field] of Object.entries(doctype.schema.fields)) {
      const fieldConfig = field as any;
      if (fieldConfig.type === "Extend" && fieldConfig.reference) {
        extendsList[key] = prepared[key as keyof Zodula.SelectDoctype<TN>];
        delete prepared[key as keyof Zodula.SelectDoctype<TN>];
      }
    }

    // Extract reference table fields
    for (const [key, field] of Object.entries(doctype.schema.fields)) {
      const fieldConfig = field as any;
      if (fieldConfig.type === "Reference Table" && fieldConfig.reference) {
        const value = prepared[key as keyof Zodula.SelectDoctype<TN>]
        if (value === "" || value === undefined || value === null) {
          refTableList[key] = [];
        } else {
          refTableList[key] = prepared[
            key as keyof Zodula.SelectDoctype<TN>
          ] as any[];
        }
        delete prepared[key as keyof Zodula.SelectDoctype<TN>];
      }
    }

    return { extendsList, refTableList };
  }

  private async updateMainDocument(
    db: Bunely,
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>
  ) {
    // Filter out Extend and Reference Table fields as they are handled separately
    const filteredPrepared = Object.entries(prepared).filter(([key, value]) => {
      const fieldConfig = doctype.schema.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;
      return !!fieldConfig?.type;
    });

    const setClause = filteredPrepared
      .filter(([key, value]) => key !== "id")
      .map(([key, value]) => `"${key}" = ?`)
      .join(", ");

    const values = filteredPrepared
      .filter(([key, value]) => key !== "id")
      .map(([key, value]) =>
        value !== null && value !== undefined ? value : null
      );

    const query = `UPDATE "${doctype?.name}" SET ${setClause} WHERE id = ?`;
    await db.run(query, [...values, this.input.id!]);


    const returned = await zodula.doctype(this.doctypeName).get(this.input.id!).bypass(true).fields(this.options.fields as any[]);
    return returned;
  }

  private async updateRelationships(
    db: Bunely,
    doctype: any,
    result: Zodula.SelectDoctype<TN>,
    relationshipData: RelationshipData
  ) {
    await this.updateExtendRelationships(
      db,
      doctype,
      result,
      relationshipData.extendsList
    );
    await this.updateRefTableRelationships(
      db,
      doctype,
      result,
      relationshipData.refTableList
    );
  }

  private async updateExtendRelationships(
    db: Bunely,
    doctype: any,
    result: Zodula.SelectDoctype<TN>,
    extendsList: Record<string, any>
  ) {
    for (const [key, payload] of Object.entries(extendsList)) {
      if (payload === undefined) continue;
      const fieldConfig = doctype.schema.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;
      const refDoctypeName = fieldConfig?.reference as Zodula.DoctypeName;
      const refDoctypeSchema = loader
        .from("doctype")
        .get(fieldConfig?.reference as Zodula.DoctypeName)?.schema;
      if (!fieldConfig || !refDoctypeSchema) continue;

      // Find the child to get the child field name
      const child = doctype.children.find(
        (c: any) =>
          c.parentDoctype === this.doctypeName &&
          c.parentFieldName === key &&
          c.type === "Extend"
      );
      const childFieldName = child?.childFieldName;

      if (!childFieldName) {
        throw new ErrorWithCode(
          `Could not find child field name for relationship ${this.doctypeName}/${key} -> ${refDoctypeName}`,
          { status: 500 }
        );
      }

      let updatedPayload = { ...payload, [childFieldName]: result.id };
      // Check if there's an existing record linked to this document via child field name
      const existingQuery = `SELECT id FROM "${refDoctypeName}" WHERE "${childFieldName}" = ?`;
      const existing = await db.get(existingQuery, [result.id]) as any;

      if (existing) {
        // Update existing record
        let formattedPayload = { ...updatedPayload, doc_status: undefined };
        ZodulaDoctypeHelper.formatDoc(
          formattedPayload as Zodula.SelectDoctype<TN>,
          refDoctypeSchema
        );
        await zodula.doctype(refDoctypeName).update(existing.id, { doc_status: result.doc_status }).bypass(true);
        (result as any)[key] = await zodula
          .doctype(refDoctypeName)
          .update(existing.id, formattedPayload)
          .bypass(this.options.bypass);

      } else {
        // Insert new record
        let formattedPayload = { ...updatedPayload, doc_status: undefined };
        ZodulaDoctypeHelper.formatDoc(
          formattedPayload as Zodula.SelectDoctype<TN>,
          refDoctypeSchema
        );
        await zodula.doctype(refDoctypeName).update(result.id, { doc_status: result.doc_status }).bypass(true);
        (result as any)[key] = await zodula
          .doctype(refDoctypeName)
          .insert(formattedPayload)
          .bypass(this.options.bypass);

      }
    }
  }

  private async updateRefTableRelationships(
    db: Bunely,
    doctype: any,
    result: Zodula.SelectDoctype<TN>,
    refTableList: Record<string, any[]>
  ) {
    for (const [key, payloadArray] of Object.entries(refTableList)) {
      if (payloadArray === undefined) continue;
      const fieldConfig = doctype.schema.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;
      const refDoctypeName = fieldConfig?.reference as Zodula.DoctypeName;
      const refDoctypeSchema = loader
        .from("doctype")
        .get(fieldConfig?.reference as Zodula.DoctypeName)?.schema;

      if (!fieldConfig || !refDoctypeSchema) continue;

      // Find the child to get the child field name
      const child = doctype.children.find(
        (c: any) =>
          c.parentDoctype === this.doctypeName &&
          c.parentFieldName === key &&
          c.type === "Reference Table"
      );
      const childFieldName = child?.childFieldName;

      if (!childFieldName) {
        throw new ErrorWithCode(
          `Could not find child field name for relationship ${this.doctypeName}/${key} -> ${refDoctypeName}`,
          { status: 500 }
        );
      }

      const existings = (await db.all(
        `SELECT id FROM "${refDoctypeName}" WHERE "${childFieldName}" = ?`,
        [result.id]
      )) as any[];
      (result as any)[key] = [];

      for (let index = 0; index < payloadArray?.length || 0; index++) {
        let payload = { ...payloadArray[index] };
        payload[childFieldName] = result.id;
        payload.doc_status = undefined;

        const isExist = existings.some(
          (existing: any) => existing.id === payload.id
        );
        if (!isExist) {
          payload = await zodula
            .doctype(refDoctypeName)
            .insert({
              ...payload,
              idx: index,
            })
            .bypass(this.options.bypass)

        } else {
          payload = await zodula
            .doctype(refDoctypeName)
            .update(payload.id, {
              ...payload,
              idx: index,
            })
            .bypass(this.options.bypass);
        }

        let formattedPayload = { ...payload, doc_status: undefined };
        ZodulaDoctypeHelper.formatDoc(
          formattedPayload as Zodula.SelectDoctype<TN>,
          refDoctypeSchema
        );
        (result as any)[key].push(
          await zodula
            .doctype(refDoctypeName)
            .update(payload.id, formattedPayload)
            .bypass(this.options.bypass)
        );
      }
      // Remove missing references
      const missings = existings.filter(
        (existing: any) =>
          !payloadArray.some((payload) => payload.id === existing.id)
      );
      for (const missing of missings) {
        await zodula
          .doctype(refDoctypeName)
          .delete(missing.id)
          .bypass(this.options.bypass);
      }
    }
  }

  bypass(bypass: boolean = true) {
    this.options.bypass = bypass;
    return this;
  }

  private async createAuditTrail(
    old: Zodula.SelectDoctype<TN>,
    result: Zodula.SelectDoctype<TN>
  ) {
    const user = await this.session.user(true);
    await ZodulaDoctypeHelper.createAuditTrail(
      this.doctypeName,
      old,
      result,
      "Update",
      user.id,
      user.name || ""
    );
  }

  private async processVectorFields(
    old: Zodula.SelectDoctype<TN>,
    result: Zodula.SelectDoctype<TN>,
    doctype: Zodula.DoctypeSchema
  ) {
    try {
      // Detect changed Vector fields
      const changedVectorFields = ZodulaDoctypeHelper.detectVectorFieldChanges(
        doctype,
        old,
        result
      );

      if (changedVectorFields.length > 0) {
        for (const changedField of changedVectorFields) {
          // Format vector data for embeddings processing
          const vectorData = ZodulaDoctypeHelper.formatVectorData(result.id!, [
            { fieldName: changedField.fieldName, value: changedField.newValue },
          ]);

          console.log(`Vector data:`, vectorData);

          // TODO: Implement embeddings processing
          // const embeddings = await ZodulaDoctypeHelper.processVectorEmbeddings(vectorData)
          // Store embeddings back to the document field
          // This would require updating the database record with the new embeddings
        }
      }
    } catch (error) {
      console.error(
        `Failed to process Vector fields for ${this.doctypeName}/${result.id}:`,
        error
      );
      // Don't throw error to avoid breaking the update operation
    }
  }

  override(override: boolean) {
    this.options.override = override;
    return this;
  }

  then(
    resolve: (value: Zodula.SelectDoctype<TN>) => void,
    reject: (reason: any) => void
  ) {
    return this._update().then(resolve).catch(reject);
  }

  catch(reject: (reason: any) => void) {
    return this._update().catch(reject);
  }
}
