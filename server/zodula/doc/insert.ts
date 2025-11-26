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

      // Validate readonly fields
      ZodulaDoctypeHelper.validateDoc(
        this.input,
        doctype.schema,
        this.options.bypass
      );

      // Prepare the document data
      const prepared = await this.prepareDocumentData(user, doctype);

      // Validate unique constraints
      await ZodulaDoctypeHelper.validateUniqueFields(
        this.doctypeName,
        prepared,
        doctype.schema,
        this.options.bypass
      );
      await this.applyFileInsert(prepared, this.doctypeName, doctype.schema);

      // Check permissions
      const roles = await zodula.session.roles();
      const { can, userPermissionCan } =
        await ZodulaDoctypeHelper.checkPermission(
          this.doctypeName,
          "can_create",
          prepared,
          {
            bypass: this.options.bypass,
            doctype,
            user,
            roles,
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

      if (!userPermissionCan) {
        throw new ErrorWithCode(
          `You do not have User Permission to create ${this.doctypeName} document`,
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
    doctype: any
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
    const newId = await naming(this.doctypeName, prepared);
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
    await loader.from("doctype").trigger(this.doctypeName, "before_insert", {
      old: undefined as any,
      doc: prepared,
      input: this.input,
    });
  }

  private async executeAfterTriggers(result: Zodula.SelectDoctype<TN>) {
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
    const returnFields =
      this.options.fields.length > 0 && !this.options.fields.includes("*")
        ? this.options.fields.map((field: any) => `"${field}"`)
        : "*";

    const preparedFields = Object.keys(prepared).map(
      (field: any) => `"${field}"`
    );
    const preparedValues = Object.values(prepared).map((value: any) =>
      value !== null && value !== undefined ? `${value}` : null
    );
    const query = `INSERT INTO "${doctype?.name}" (${preparedFields}) VALUES (${preparedValues.map((v) => "?").join(", ")})`;
    await db.run(query, preparedValues);
    const returned = (await db.get(
      `SELECT ${returnFields} FROM "${doctype?.name}" WHERE id = '${prepared.id}'`
    )) as any;
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
    doctype: any,
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
        updatedPayload[fieldConfig.reference_alias!] = result.id;

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
    doctype: any,
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
      const refDoctypeAlias = fieldConfig?.reference_alias as string;

      if (!fieldConfig || !refDoctypeSchema) continue;

      try {
        (result as any)[key] = [];

        for (let index = 0; index < payloadArray?.length || 0; index++) {
          let payload = { ...payloadArray[index] };
          payload[refDoctypeAlias] = result.id;

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

        console.log(
          `TODO: Process Vector fields for ${this.doctypeName}/${result.id}:`
        );
        console.log(vectorData);

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
