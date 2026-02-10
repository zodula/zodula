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

  private async _insert() {
    try {
      const db = Database("main");
      const user = await this.session.user(true);
      const doctype = loader.from("doctype").get(this.doctypeName);
      const organizationName = await this.session.organization(true);
      const organization = await zodula.doctype("zodula__Organization").get(organizationName || "System Panel").bypass(true).fields(["abbr","name"])

      if(!this.input.organization) {
        this.input.organization = organization?.name || "System Panel";
        this.input.organization_abbr = organization?.abbr || "";

      }
      if(doctype.config.is_global === 1) {
        this.input.organization = "System Panel";
        this.input.organization_abbr = organization?.abbr || "";
      }

      // Check tier requirements and max_doc limits
      await this.validateTierRequirements(doctype, organization?.name || "System Panel");

      // Prepare the document data
      let prepared = await this.prepareDocumentData(user, doctype, organization?.abbr || "", organization?.name || "System Panel");

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

      // Execute the insert process
      return await this.executeInsert(db, doctype, prepared);
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
      doc_status: this.input.doc_status || 0,
    } as Zodula.SelectDoctype<TN>;

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

    // Get organization's tier level
    let orgDoc;
    try {
      orgDoc = await zodula
        .doctype("zodula__Organization")
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
    const orgTierInt = Number(orgDoc?.tier_level || "0") || 0;

    // Check if insert_tier_required is set in doctype config
    const insertTierRequiredInt = Number(doctype.config.insert_tier_required) || 0;
    if(insertTierRequiredInt > 0 && orgTierInt < insertTierRequiredInt) {
      throw new ErrorWithCode(
        `This doctype requires tier level ${insertTierRequiredInt} or higher. Your organization has tier level ${orgTierInt}.`,
        { status: 403 }
      );
    }

    // Get max_doc by merging configs from all apps and cascading from previous tiers
    const maxDoc = await this.getMaxDocForDoctype(orgTierInt, this.doctypeName);

    // If max_doc is -1, it means unlimited
    if (maxDoc === -1) {
      return;
    }

    // Count existing documents for this doctype in this organization
    let existingDocs: { docs: any[]; count: number };
    try {
      existingDocs = await zodula
        .doctype(this.doctypeName)
        .select()
        .where("organization", "=", organization as any)
        .bypass(true);
    } catch {
      existingDocs = { docs: [], count: 0 };
    }

    const currentCount = existingDocs.count || 0;

    // Check if adding one more document would exceed the limit
    if (currentCount >= maxDoc) {
      throw new ErrorWithCode(
        `Maximum document limit (${maxDoc}) reached for doctype ${this.doctypeName} at tier level ${orgTierInt}.`,
        { status: 403 }
      );
    }
  }

  private async getMaxDocForDoctype(tierLevel: number, doctypeName: Zodula.DoctypeName): Promise<number> {
    // Get all apps
    let apps: { docs: any[]; count: number };
    try {
      apps = await zodula
        .doctype("zodula__App")
        .select()
        .bypass(true);
    } catch {
      apps = { docs: [], count: 0 };
    }

    // Try to find max_doc starting from the current tier level and cascading down
    let maxDoc = -1; // Default to unlimited
    
    for (let tier = tierLevel; tier >= 0; tier--) {
      const tierConfigs: number[] = [];
      let hasUnlimited = false;
      
      // Get tier configs from all apps for this tier level
      for (const app of apps.docs || []) {
        let tierConfig: { docs: any[]; count: number };
        try {
          tierConfig = await zodula
            .doctype("zodula__Tier Config")
            .select()
            .where("tier_level", "=", tier.toString() as "0" | "1" | "2" | "3" | "4" | "5")
            .where("app", "=", app.id)
            .bypass(true);
        } catch {
          tierConfig = { docs: [], count: 0 };
        }

        if (tierConfig.count > 0 && tierConfig.docs && tierConfig.docs.length > 0) {
          const tierConfigDoc = tierConfig.docs[0];

          // Get doctype items for this tier config
          let doctypeItems: { docs: any[]; count: number };
          try {
            doctypeItems = await zodula
              .doctype("zodula__Tier Config Doctype Item")
              .select()
              .where("tier_config", "=", tierConfigDoc.id)
              .where("doctype", "=", doctypeName)
              .bypass(true);
          } catch {
            doctypeItems = { docs: [], count: 0 };
          }

          if (doctypeItems.count > 0 && doctypeItems.docs && doctypeItems.docs.length > 0) {
            const doctypeItem = doctypeItems.docs[0];
            const itemMaxDoc = Number(doctypeItem.max_doc || "-1") || -1;
            if (itemMaxDoc === -1) {
              hasUnlimited = true;
            } else {
              tierConfigs.push(itemMaxDoc);
            }
          }
        }
      }

      // If we found any configs at this tier level, use the highest max_doc
      // If any app has unlimited (-1), the tier is unlimited
      if (hasUnlimited) {
        maxDoc = -1;
        break; // Use the first tier level (highest) that has configs
      } else if (tierConfigs.length > 0) {
        maxDoc = Math.max(...tierConfigs);
        break; // Use the first tier level (highest) that has configs
      }
    }

    return maxDoc;
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
            prepared.organization || "System Panel",
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
          prepared.organization || "System Panel",
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
            prepared.organization || "System Panel",
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
                prepared.organization || "System Panel",
                doctypeName,
                docId,
                fieldName,
                file
              )
            );
          }
        }

        // Set value to filename
        (prepared as any)[key] = filename;
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
      } catch (error) {
        throw new ErrorWithCode(
          `Error inserting ${this.doctypeName}/${result.id}/${key}: ${error}`,
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
      } catch (error) {
        throw new ErrorWithCode(
          `Error inserting ${this.doctypeName}/${result.id}/${key}: ${error}`,
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
