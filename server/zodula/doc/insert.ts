import { ZodulaSession } from "../session";
import { loader } from "@/zodula/server/loader";
import { naming } from "../naming";
import { ZodulaDoctypeHelper } from "./helper";
import { zodula } from "..";
import { Database } from "../../database";
import type { Bunely } from "bunely";
import path from "path";
import fs from "fs/promises";
import { ErrorWithCode } from "@/zodula/error";
import type { DoctypeMetadata } from "../../loader/plugins/doctype";

interface InsertOptions {
  bypass: boolean;
  override: boolean;
  fields: (keyof Zodula.SelectDoctype<any>)[];
}

interface RelationshipData {
  extendsList: Record<string, any>;
  refTableList: Record<string, any[]>;
}

export class ZodulaDoctypeInsert<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private doctypeName: TN;
  private session: ZodulaSession = new ZodulaSession();
  private input: Zodula.InsertDoctype<TN> = {} as Zodula.InsertDoctype<TN>;
  private options: InsertOptions = {
    bypass: false,
    override: false,
    fields: [],
  };

  constructor(doctypeName: TN, input: Zodula.InsertDoctype<TN>) {
    this.doctypeName = doctypeName;
    this.input = input;
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN>)[]) {
    this.options.fields = fields;
    return this;
  }

  private async validateIdUniqueness(db: Bunely, doctype: DoctypeMetadata, prepared: Zodula.SelectDoctype<TN>) {
    const id = prepared.id
    const exists = await db.get(`SELECT id FROM "${doctype.name}" WHERE id = ?`, [id])
    if (exists) {
      throw new ErrorWithCode(`ID ${id} already exists`, { status: 400 })
    }
  }

  private async _insert() {
    try {
      const db = Database("main");
      const user = await this.session.user(true);
      const doctype = loader.from("doctype").get(this.doctypeName);
      const organizationName = await this.session.organization(true);

      if (!this.input.doc_organization) {
        this.input.doc_organization = organizationName || "System Panel";
      }
      if(!organizationName && !this.options.bypass) {
        throw new ErrorWithCode("Organization is required", { status: 400 });
      }
      const organization = await zodula.doctype("Organization").get(this.input.doc_organization || "System Panel").bypass(true).fields(["abbr", "unique_name"])
      this.input.doc_organization_abbr = organization?.abbr || "";
      if (doctype.config.is_global === 1 && organizationName !== "System Panel" && !this.options.bypass) {
        throw new ErrorWithCode("Global doctype can only be created in System Panel organization", { status: 400 });
      }

      // Check tier requirements and max_doc limits
      await this.validateTierRequirements(doctype, organization?.unique_name || "System Panel");

      // Prepare the document data
      let prepared = await this.prepareDocumentData(user, doctype, organization?.abbr || "", organization?.unique_name || "System Panel");

      // Validate readonly fields
      ZodulaDoctypeHelper.validateDoc(
        prepared,
        doctype.schema,
        this.options.bypass
      );

      // Validate unique constraints
      await ZodulaDoctypeHelper.validateUniqueFields(
        this.doctypeName,
        prepared,
        doctype.schema,
        this.options.bypass
      );
      await this.applyFileInsert(prepared, this.doctypeName, doctype.schema);

      // Check permissions
      const { can } =
        await ZodulaDoctypeHelper.checkPermission(
          this.doctypeName,
          "can_create",
          prepared,
          {
            bypass: this.options.bypass,
            doctype,
          }
        );

      if (!can) {
        throw new ErrorWithCode(
          "You do not have permission to create this document",
          {
            status: 403,
          }
        );
      }

      // validate id uniqueness
      await this.validateIdUniqueness(db, doctype, prepared);

      // Execute the insert process
      const result = await this.executeInsert(db, doctype, prepared);
      await this.createAuditTrail(result);
      return result;
    } catch (error: any) {
      console.error(error);
      throw new ErrorWithCode(
        ZodulaDoctypeHelper.formatSqlError(error?.message),
        {
          status: 500,
        }
      );
    }
  }

  private async prepareDocumentData(
    user: any,
    doctype: DoctypeMetadata,
    organizationAbbr: string,
    organizationName: string
  ): Promise<Zodula.SelectDoctype<TN>> {
    let prepared = {
      ...this.input,
      idx: this.input.idx || 0,
      owner: user.id || null,
      created_at: $zodula.utils.format(new Date(), "datetime"),
      updated_at: $zodula.utils.format(new Date(), "datetime"),
      created_by: user.id || null,
      updated_by: user.id || null,
      doc_status: this.input.doc_status || "Draft",
    } as Zodula.SelectDoctype<TN>;

    // Run before_change so field-based naming_series (e.g. field:naming_series) can be set from other doc fields
    const namingSeriesConfig = doctype.schema.naming_series;
    if (typeof namingSeriesConfig === "string" && namingSeriesConfig.startsWith("field:")) {
      await loader.from("doctype").trigger(this.doctypeName, "before_change", {
        old: undefined as any,
        doc: prepared,
        input: this.input,
      });
    }

    // Generate new ID
    let newId = await naming(this.doctypeName, prepared, organizationAbbr, organizationName || "");
    prepared.id = newId;

    // Apply override if specified
    if (this.options?.override) {
      prepared = {
        ...prepared,
        ...this.input,
      };
    }

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

  private async validateTierRequirements(doctype: any, organization: string) {
    // Skip tier validation if bypass is enabled
    if (this.options.bypass) {
      return;
    }
    // Skip tier and limit checks for System Panel organization
    if (organization === "System Panel") {
      return;
    }

    let orgDoc: any;
    try {
      orgDoc = await zodula
        .doctype("Organization")
        .get(organization)
        .bypass(true);
    } catch {
      orgDoc = null;
    }
    if (!orgDoc) {
      throw new ErrorWithCode(
        `Organization ${organization} not found`,
        { status: 404 }
      );
    }

    // Resolve doctype's app id
    const appName = doctype.appName as string | undefined;
    let appId: string | null = null;
    if (appName) {
      try {
        const appRes = await zodula.doctype("App").select().where("name", "=", appName as any).bypass(true);
        appId = appRes.docs?.[0]?.id ?? null;
      } catch {
        appId = null;
      }
    }

    // Organization's tier for this app: from Organization App Tier Item (effective tier, considering expires_at)
    let orgTierInt = 0;
    if (appId && orgDoc.id) {
      try {
        const items = await zodula
          .doctype("Organization App Tier Item")
          .select()
          .where("parentid", "=", orgDoc.id)
          .where("parentype", "=", "Organization")
          .where("parentfield", "=", "organization_app_tier_items")
          .where("app", "=", appId)
          .bypass(true);
        const item = items.docs?.[0];
        if (item) {
          const expiresAt = item.expires_at ? zodula.utils.parseDate(item.expires_at) : null;
          if (!expiresAt || expiresAt >= new Date()) {
            orgTierInt = Number(item.tier_level || "0") || 0;
          }
        }
      } catch {
        orgTierInt = 0;
      }
    }

    // Check if insert_tier_required is set in doctype config
    const insertTierRequiredInt = Number(doctype.config.insert_tier_required) || 0;
    if (insertTierRequiredInt > 0 && orgTierInt < insertTierRequiredInt) {
      throw new ErrorWithCode(
        `This doctype requires tier level ${insertTierRequiredInt} or higher. Your organization has tier level ${orgTierInt} for this app.`,
        { status: 403 }
      );
    }

    // Get limits from App Tier Config for this app (cascading from current tier down)
    const limits = await this.getTierLimitsForDoctype(orgTierInt, this.doctypeName, appId);

    const { maxDoc, maxDocPerMonth, maxDocPerDay } = limits;
    const orgWhere = (): [any, "=", string] => ["doc_organization", "=", organization];

    // -1 = unlimited; 0 = cannot insert; >0 = enforce limit
    if (maxDoc >= 0) {
      let existingDocs: { count: number };
      try {
        const [f, op, v] = orgWhere();
        existingDocs = await zodula
          .doctype(this.doctypeName)
          .select()
          .where(f, op, v)
          .bypass(true);
      } catch {
        existingDocs = { count: 0 };
      }
      const currentCount = existingDocs.count || 0;
      if (currentCount >= maxDoc) {
        throw new ErrorWithCode(
          `Maximum document limit (${maxDoc}) reached for doctype ${this.doctypeName}.`,
          { status: 403 }
        );
      }
    }

    if (maxDocPerMonth >= 0) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthStartStr = zodula.utils.format(monthStart, "datetime");
      const monthEndStr = zodula.utils.format(monthEnd, "datetime");
      let res: { count: number };
      try {
        const [f, op, v] = orgWhere();
        res = await zodula
          .doctype(this.doctypeName)
          .select()
          .where(f, op, v)
          .where("created_at" as any, ">=", monthStartStr)
          .where("created_at" as any, "<=", monthEndStr)
          .bypass(true);
      } catch {
        res = { count: 0 };
      }
      const countThisMonth = res.count ?? 0;
      if (countThisMonth >= maxDocPerMonth) {
        throw new ErrorWithCode(
          `Maximum documents per month (${maxDocPerMonth}) reached for doctype ${this.doctypeName}.`,
          { status: 403 }
        );
      }
    }

    if (maxDocPerDay >= 0) {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const dayStartStr = zodula.utils.format(dayStart, "datetime");
      const dayEndStr = zodula.utils.format(dayEnd, "datetime");
      let res: { count: number };
      try {
        const [f, op, v] = orgWhere();
        res = await zodula
          .doctype(this.doctypeName)
          .select()
          .where(f, op, v)
          .where("created_at" as any, ">=", dayStartStr)
          .where("created_at" as any, "<=", dayEndStr)
          .bypass(true);
      } catch {
        res = { count: 0 };
      }
      const countToday = res.count ?? 0;
      if (countToday >= maxDocPerDay) {
        throw new ErrorWithCode(
          `Maximum documents per day (${maxDocPerDay}) reached for doctype ${this.doctypeName}.`,
          { status: 403 }
        );
      }
    }
  }

  private async getTierLimitsForDoctype(
    tierLevel: number,
    doctypeName: Zodula.DoctypeName,
    appId: string | null
  ): Promise<{ maxDoc: number; maxDocPerMonth: number; maxDocPerDay: number }> {
    const unlimited = { maxDoc: -1, maxDocPerMonth: -1, maxDocPerDay: -1 };
    if (!appId) return unlimited;

    const parseLimit = (raw: any): number => {
      if (raw === null || raw === undefined || raw === "") return -1;
      const n = Number(raw);
      return Number.isNaN(n) ? -1 : n;
    };

    for (let tier = tierLevel; tier >= 0; tier--) {
      let appTierConfig: { docs: any[]; count: number };
      try {
        appTierConfig = await zodula
          .doctype("App Tier Config")
          .select()
          .where("tier_level", "=", tier.toString() as "0" | "1" | "2" | "3" | "4" | "5")
          .where("app", "=", appId)
          .bypass(true);
      } catch {
        appTierConfig = { docs: [], count: 0 };
      }

      if (appTierConfig.count > 0 && appTierConfig.docs?.[0]) {
        const configDoc = appTierConfig.docs[0];
        let doctypeItems: { docs: any[]; count: number };
        try {
          doctypeItems = await zodula
            .doctype("App Tier Config Doctype Item")
            .select()
            .where("parentid", "=", configDoc.id)
            .where("parentype", "=", "App Tier Config")
            .where("parentfield", "=", "app_tier_config_doctype_items")
            .where("doctype", "=", doctypeName)
            .bypass(true);
        } catch {
          doctypeItems = { docs: [], count: 0 };
        }

        if (doctypeItems.count > 0 && doctypeItems.docs?.[0]) {
          const item = doctypeItems.docs[0];
          return {
            maxDoc: parseLimit(item.max_doc),
            maxDocPerMonth: parseLimit(item.max_doc_per_month),
            maxDocPerDay: parseLimit(item.max_doc_per_day),
          };
        }
      }
    }

    return unlimited;
  }

  private async applyFileInsert(
    prepared: Zodula.SelectDoctype<TN>,
    doctypeName: Zodula.DoctypeName,
    doctype: Zodula.DoctypeSchema
  ) {
    for (let [key, value] of Object.entries(prepared)) {
      const fieldConfig = doctype.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;

      if (fieldConfig?.type === "File" && value instanceof File) {
        const doctypeName = this.doctypeName;
        const docId = prepared.id!;
        const fieldName = key;
        const filename = value.name;

        // Create directory structure for the file
        await fs.mkdir(
          path.join(
            process.cwd(),
            ".zodula_data",
            "files",
            prepared.doc_organization || "System Panel",
            "doctypes",
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
          prepared.doc_organization || "System Panel",
          doctypeName,
          docId,
          fieldName,
          filename
        );
        await Bun.write(fileDir, value);

        // Clean up any existing files in the directory (for consistency with update behavior)
        const files = await fs.readdir(
          path.join(
            process.cwd(),
            ".zodula_data",
            "files",
            prepared.doc_organization || "System Panel",
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
                prepared.doc_organization || "System Panel",
                doctypeName,
                docId,
                fieldName,
                file
              )
            );
          }
        }

        const url = ["", "files", prepared.doc_organization || "System Panel", doctypeName, docId, fieldName, filename].join("/");
        // Set value to url
        (prepared as any)[key] = url;
      }
    }
  }

  private async executeInsert(
    db: any,
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>
  ): Promise<Zodula.SelectDoctype<TN>> {
    // Execute before triggers
    await this.executeBeforeTriggers(prepared);
    // Extract relationship data
    const relationshipData = this.extractRelationshipData(doctype, prepared);

    // Insert main document
    const result = await this.insertMainDocument(db, doctype, prepared);

    // Insert relationships
    await this.insertRelationships(db, doctype, result, relationshipData);

    // Process Vector fields for embeddings
    await this.processVectorFields(result, doctype.schema);

    // Execute after triggers
    await this.executeAfterTriggers(result);

    return ZodulaDoctypeHelper.formatDocResult<TN>(result, doctype.schema);
  }

  private async createAuditTrail(result: Zodula.SelectDoctype<TN>) {
    const user = await this.session.user(true);
    await ZodulaDoctypeHelper.createAuditTrail(
      this.doctypeName,
      {} as Zodula.SelectDoctype<TN>,
      result,
      "Insert",
      user.id,
      user.name || ""
    );
  }

  private async executeBeforeTriggers(prepared: Zodula.SelectDoctype<TN>) {
    await loader.from("doctype").trigger(this.doctypeName, "before_change", {
      old: undefined as any,
      doc: prepared,
      input: this.input,
    });
    await loader.from("doctype").trigger(this.doctypeName, "before_insert", {
      old: undefined as any,
      doc: prepared,
      input: this.input,
    });
    await loader.from("doctype").trigger(this.doctypeName, "before_save", {
      old: undefined as any,
      doc: prepared,
      input: this.input,
    });
  }

  private async executeAfterTriggers(result: Zodula.SelectDoctype<TN>) {
    await loader.from("doctype").trigger(this.doctypeName, "after_change", {
      old: undefined as any,
      doc: result,
      input: this.input,
    });
    await loader.from("doctype").trigger(this.doctypeName, "after_insert", {
      old: undefined as any,
      doc: result,
      input: this.input,
    });
    await loader.from("doctype").trigger(this.doctypeName, "after_save", {
      old: undefined as any,
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
        refTableList[key] = prepared[
          key as keyof Zodula.SelectDoctype<TN>
        ] as any[];
        delete prepared[key as keyof Zodula.SelectDoctype<TN>];
      }
    }

    return { extendsList, refTableList };
  }

  private async insertMainDocument(
    db: Bunely,
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>
  ) {
    const preparedFields = Object.keys(prepared).map(
      (field: any) => `"${field}"`
    );
    const preparedValues = Object.values(prepared).map((value: any) =>
      value !== null && value !== undefined ? `${value}` : null
    );
    const query = `INSERT INTO "${doctype?.name}" (${preparedFields}) VALUES (${preparedValues.map((v) => "?").join(", ")})`;
    await db.run(query, preparedValues);
    const returned = await zodula.doctype(this.doctypeName).get(prepared.id!).bypass(true).fields(this.options.fields as any[])
    return returned;
  }

  private async insertRelationships(
    db: Bunely,
    doctype: any,
    result: Zodula.SelectDoctype<TN>,
    relationshipData: RelationshipData
  ) {
    await this.insertExtendRelationships(
      db,
      doctype,
      result,
      relationshipData.extendsList
    );
    await this.insertRefTableRelationships(
      db,
      doctype,
      result,
      relationshipData.refTableList
    );
  }

  private async insertExtendRelationships(
    db: any,
    doctype: DoctypeMetadata,
    result: Zodula.SelectDoctype<TN>,
    extendsList: Record<string, any>
  ) {
    for (const [key, payload] of Object.entries(extendsList)) {
      const fieldConfig = doctype.schema.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;
      const refDoctypeName = fieldConfig?.reference as Zodula.DoctypeName;
      const refDoctypeSchema = loader
        .from("doctype")
        .get(fieldConfig?.reference as Zodula.DoctypeName)?.schema;

      if (!fieldConfig || !refDoctypeSchema) continue;

      try {
        let updatedPayload = { ...payload };
        updatedPayload["parentid"] = result.id;
        updatedPayload["parentype"] = this.doctypeName;
        updatedPayload["parentfield"] = key;
        updatedPayload["doc_organization"] = result.doc_organization;
        updatedPayload["doc_organization_abbr"] = result.doc_organization_abbr;

        let formattedPayload = { ...updatedPayload };
        ZodulaDoctypeHelper.formatDoc(
          formattedPayload as Zodula.SelectDoctype<TN>,
          refDoctypeSchema
        );
        const insertedPayload = await zodula
          .doctype(refDoctypeName)
          .insert(formattedPayload)
          .bypass(this.options.bypass);
        (result as any)[key] = insertedPayload;
      } catch (error: any) {
        throw new ErrorWithCode(
          `Error inserting ${this.doctypeName}/${result.id}/${key}: ${error?.message || error}`,
          {
            status: 500,
          }
        );
      }
    }
  }

  private async insertRefTableRelationships(
    db: any,
    doctype: DoctypeMetadata,
    result: Zodula.SelectDoctype<TN>,
    refTableList: Record<string, any[]>
  ) {
    for (const [key, payloadArray = []] of Object.entries(refTableList)) {
      const fieldConfig = doctype.schema.fields[
        key as keyof Zodula.DoctypeSchema
      ] as any;
      const refDoctypeName = fieldConfig?.reference as Zodula.DoctypeName;
      const refDoctypeSchema = loader
        .from("doctype")
        .get(fieldConfig?.reference as Zodula.DoctypeName)?.schema;

      if (!fieldConfig || !refDoctypeSchema) continue;

      try {
        (result as any)[key] = [];

        for (let index = 0; index < payloadArray?.length || 0; index++) {
          let payload = { ...payloadArray[index] };
          payload["parentid"] = result.id;
          payload["parentype"] = this.doctypeName;
          payload["parentfield"] = key;

          let formattedPayload = { ...payload };
          ZodulaDoctypeHelper.formatDoc(
            formattedPayload as Zodula.SelectDoctype<TN>,
            refDoctypeSchema
          );
          const insertedPayload = await zodula
            .doctype(refDoctypeName)
            .insert(formattedPayload)
            .bypass(this.options.bypass);
          (result as any)[key].push(insertedPayload);
        }
      } catch (error: any) {
        throw new ErrorWithCode(
          `Error inserting ${this.doctypeName}/${result.id}/${key}: ${error?.message || error}`,
          {
            status: 500,
          }
        );
      }
    }
  }

  private async processVectorFields(
    result: Zodula.SelectDoctype<TN>,
    doctype: Zodula.DoctypeSchema
  ) {
    try {
      // Detect Vector fields in the document
      const vectorFields = ZodulaDoctypeHelper.detectVectorFields(
        doctype,
        result
      );

      if (vectorFields.length > 0) {
        // Format vector data for embeddings processing
        const vectorData = ZodulaDoctypeHelper.formatVectorData(
          result.id!,
          vectorFields
        );

        // TODO: Implement embeddings processing
        // const embeddings = await ZodulaDoctypeHelper.processVectorEmbeddings(vectorData)
        // Store embeddings back to the document fields
        // for (const field of vectorFields) {
        //     if (embeddings[field.fieldName]) {
        //         // Update the field with embeddings
        //         // This would require updating the database record
        //     }
        // }
      }
    } catch (error) {
      console.error(
        `Failed to process Vector fields for ${this.doctypeName}/${result.id}:`,
        error
      );
      // Don't throw error to avoid breaking the insert operation
    }
  }

  bypass(bypass: boolean = true) {
    this.options.bypass = bypass;
    return this;
  }

  override(override: boolean = true) {
    this.options.override = override;
    return this;
  }

  catch(reject: (reason: any) => void) {
    return this._insert().catch(reject);
  }

  then(
    resolve: (value: Zodula.SelectDoctype<TN>) => void,
    reject: (reason: any) => void
  ) {
    return this._insert().then(resolve).catch(reject);
  }
}
