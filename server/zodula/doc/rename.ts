import { Database } from "@/zodula/server/database/database";
import { ZodulaSession } from "../session";
import { loader } from "@/zodula/server/loader";
import { ZodulaDoctypeHelper } from "./helper";
import { zodula } from "..";
import type { Bunely } from "bunely";
import { ErrorWithCode } from "@/zodula/error";
import { DEFAULT_ON_DELETE_BEHAVIOR } from "./delete";

interface RenameOptions {
  bypass: boolean;
  fields: (keyof Zodula.SelectDoctype<any>)[];
}

export class ZodulaDoctypeRename<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private doctypeName: TN;
  private session: ZodulaSession = new ZodulaSession();
  private options: RenameOptions = {
    bypass: false,
    fields: [],
  };

  constructor(
    doctypeName: TN,
    private oldId: string,
    private newId: string
  ) {
    this.doctypeName = doctypeName;
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN>)[]) {
    this.options.fields = fields;
    return this;
  }

  private async _rename() {
    const db = Database("main");
    const user = await this.session.user(true);
    const doctype = loader.from("doctype").get(this.doctypeName);
    const old = await zodula
      .doctype(this.doctypeName)
      .get(this.oldId)
      .bypass(true)
      .unsafe();

    // Validate document exists and can be renamed
    this.validateDocument(old);

    // Check permissions
    const roles = await zodula.session.roles();
    const { can, userPermissionCan } =
      await ZodulaDoctypeHelper.checkPermission(
        this.doctypeName,
        "can_update",
        old,
        {
          bypass: this.options.bypass,
          doctype,
          user,
          roles,
        }
      );

    if (!can) {
      throw new ErrorWithCode(
        `You do not have User Permission to rename ${this.doctypeName} document with id ${this.oldId}`,
        {
          status: 403,
        }
      );
    }

    if (!userPermissionCan) {
      throw new ErrorWithCode(
        `You do not have User Permission to rename ${this.doctypeName} document with id ${this.oldId}`,
        {
          status: 403,
        }
      );
    }

    // Execute the rename process
    return await this.executeRename(db, doctype, old);
  }

  private validateDocument(old: Zodula.SelectDoctype<TN> | null) {
    if (!old) {
      throw new Error(`Document with id ${this.oldId} not found`, {
        cause: 404,
      });
    }
    if (old.doc_status === 2) {
      throw new ErrorWithCode(
        `Cannot rename cancelled document. Document with id ${this.oldId} has been cancelled.`,
        { status: 400 }
      );
    }
  }

  private hasIdChanged(): boolean {
    return this.oldId !== this.newId;
  }

  private async executeRename(
    db: Bunely,
    doctype: any,
    old: Zodula.SelectDoctype<TN>
  ): Promise<Zodula.SelectDoctype<TN>> {
    // Check if ID actually changed, if not return the original document
    if (!this.hasIdChanged()) {
      return ZodulaDoctypeHelper.formatDocResult<TN>(old, doctype.schema);
    }

    const prepared = { ...old, id: this.newId } as Zodula.SelectDoctype<TN>;

    // Execute before triggers (same as update)
    await this.executeBeforeTriggers(old, prepared);

    // Update child references first
    await this.updateReferenceFields(db, doctype, this.oldId, this.newId);

    // Update audit trail records to reference new ID
    await this.updateAuditTrailReferences(db, this.oldId, this.newId);

    // Update main document ID
    const result = await this.updateMainDocument(db, doctype, old);

    // Create audit trail for rename action
    await this.createAuditTrail(old, result);

    // Execute after triggers (same as update)
    await this.executeAfterTriggers(old, result);

    return ZodulaDoctypeHelper.formatDocResult<TN>(result, doctype.schema);
  }

  private async updateMainDocument(
    db: Bunely,
    doctype: any,
    old: Zodula.SelectDoctype<TN>
  ) {
    const returnFields =
      this.options.fields.length > 0
        ? this.options.fields.map((field: any) => `"${field}"`)
        : "*";

    // Update the document ID
    const updateQuery = `UPDATE "${doctype?.name}" SET id = '${this.newId}' WHERE id = '${this.oldId}'`;
    await db.run(updateQuery);

    const returned = (await db.get(
      `SELECT ${returnFields} FROM "${doctype?.name}" WHERE id = '${this.newId}'`
    )) as any;
    return returned;
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
          input: undefined,
        });
    }

    if (isDraft) {
      await loader
        .from("doctype")
        .trigger(this.doctypeName, "before_save", {
          old,
          doc: prepared,
          input: undefined,
        });
    }

    await loader
      .from("doctype")
      .trigger(this.doctypeName, "before_change", {
        old,
        doc: prepared,
        input: undefined,
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
          input: undefined,
        });
    }

    if (isDraft) {
      await loader
        .from("doctype")
        .trigger(this.doctypeName, "after_save", {
          old,
          doc: result,
          input: undefined,
        });
    }

    await loader
      .from("doctype")
      .trigger(this.doctypeName, "after_change", {
        old,
        doc: result,
        input: undefined,
      });
  }

  private async updateReferenceFields(
    db: Bunely,
    doctype: any,
    oldId: string,
    newId: string
  ) {
    const allDoctypes = loader.from("doctype").list();
    for (const doctype of allDoctypes) {
      const doctypeFields = doctype.schema.fields as Record<
        string,
        Zodula.Field
      >;
      for (const [fieldName, fieldConfig] of Object.entries(doctypeFields)) {
        const field = fieldConfig as any;
        if (
          field.type === "Reference" &&
          field.reference === this.doctypeName
        ) {
          if (fieldName) {
            const existings = await zodula
              .doctype(doctype.name)
              .select()
              .where(fieldName as any, "=", oldId)
              .bypass(true);
            for (const existing of existings.docs) {
              await zodula
                .doctype(doctype.name)
                .update(existing.id, {
                  [fieldName]: newId,
                })
                .bypass(true);
            }
          }
        }
      }
    }
  }

  private async updateAuditTrailReferences(
    db: Bunely,
    oldId: string,
    newId: string
  ) {
    // Update all audit trail records that reference the old document ID
    const updateQuery = `UPDATE "zodula__Audit Trail" SET doctype_id = ? WHERE doctype = ? AND doctype_id = ?`;
    await db.run(updateQuery, [newId, this.doctypeName, oldId]);
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
      "Rename",
      user.id,
      user.name || ""
    );
  }

  bypass(bypass: boolean = true) {
    this.options.bypass = bypass;
    return this;
  }

  then(
    resolve: (value: Zodula.SelectDoctype<TN>) => void,
    reject: (reason: any) => void
  ) {
    return this._rename().then(resolve).catch(reject);
  }

  catch(reject: (reason: any) => void) {
    return this._rename().catch(reject);
  }
}
