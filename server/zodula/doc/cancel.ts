import { Database } from "@/zodula/server/database/database";
import { ZodulaSession } from "../session";
import { loader } from "@/zodula/server/loader";
import { ZodulaDoctypeHelper } from "./helper";
import { zodula } from "..";
import type { Bunely } from "bunely";
import { ErrorWithCode } from "@/zodula/error";

interface CancelOptions {
  bypass: boolean;
  fields: (keyof Zodula.SelectDoctype<any>)[];
}

export class ZodulaDoctypeCancel<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private doctypeName: TN;
  private session: ZodulaSession = new ZodulaSession();
  private options: CancelOptions = {
    bypass: false,
    fields: [],
  };

  constructor(
    doctypeName: TN,
    private id: string
  ) {
    this.doctypeName = doctypeName;
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN>)[]) {
    this.options.fields = fields;
    return this;
  }

  private async _cancel() {
    const db = Database("main");
    const user = await this.session.user(true);
    const doctype = loader.from("doctype").get(this.doctypeName);
    const old = await zodula
      .doctype(this.doctypeName)
      .get(this.id)
      .bypass(true)
      .unsafe();

    // Validate document exists and can be cancelled
    this.validateDocument(old);

    // Check if doctype is submittable
    if (doctype?.schema.is_submittable !== 1) {
      throw new ErrorWithCode(
        `Doctype ${this.doctypeName} is not submittable`,
        { status: 400 }
      );
    }

    // Check permissions
    const roles = await zodula.session.roles();
    const { can, userPermissionCan } =
      await ZodulaDoctypeHelper.checkPermission(
        this.doctypeName,
        "can_cancel",
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
        `You do not have permission to cancel this document`,
        {
          status: 403,
        }
      );
    }

    if (!userPermissionCan) {
      throw new ErrorWithCode(
        `You do not have User Permission to cancel ${this.doctypeName} document with id ${this.id}`,
        {
          status: 403,
        }
      );
    }

    // Prepare the document data for cancellation
    const prepared = await this.prepareDocumentData(old, user, doctype);

    // Execute the cancel process
    return await this.executeCancel(db, doctype, old, prepared);
  }

  private validateDocument(old: Zodula.SelectDoctype<TN> | null) {
    if (!old) {
      throw new Error(`Document with id ${this.id} not found`, { cause: 404 });
    }
    if (old.doc_status === 0) {
      throw new ErrorWithCode(
        `Document with id ${this.id} is not submitted and cannot be cancelled`,
        { status: 400 }
      );
    }
    if (old.doc_status === 2) {
      throw new ErrorWithCode(
        `Document with id ${this.id} is already cancelled`,
        { status: 400 }
      );
    }
  }

  private async prepareDocumentData(
    old: Zodula.SelectDoctype<TN>,
    user: any,
    doctype: any
  ): Promise<Zodula.SelectDoctype<TN>> {
    const prepared = {
      ...old,
      doc_status: 2,
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

  private async executeCancel(
    db: Bunely,
    doctype: any,
    old: Zodula.SelectDoctype<TN>,
    prepared: Zodula.SelectDoctype<TN>
  ): Promise<Zodula.SelectDoctype<TN>> {
    // Execute before cancel trigger
    await loader
      .from("doctype")
      .trigger(this.doctypeName, "before_cancel", {
        old,
        doc: prepared,
        input: undefined,
      });

    // Update main document
    const result = await this.updateMainDocument(db, doctype, prepared);

    // Create audit trail for cancel action
    await this.createAuditTrail(old, result);

    // Execute after cancel trigger
    await loader
      .from("doctype")
      .trigger(this.doctypeName, "after_cancel", {
        old,
        doc: result,
        input: undefined,
      });

    return ZodulaDoctypeHelper.formatDocResult<TN>(result, doctype.schema);
  }

  private async updateMainDocument(
    db: Bunely,
    doctype: any,
    prepared: Zodula.SelectDoctype<TN>
  ) {
    const returnFields =
      this.options.fields.length > 0
        ? this.options.fields.map((field: any) => `"${field}"`)
        : "*";

    const setClause = Object.entries(prepared)
      .filter(([key, value]) => key !== "id")
      .map(
        ([key, value]) =>
          `"${key}" = ${value !== null && value !== undefined ? `"${value}"` : "NULL"}`
      )
      .join(", ");

    const query = `UPDATE "${doctype?.name}" SET ${setClause} WHERE id = "${this.id}"`;
    await db.run(query);

    const returned = await db.get(
      `SELECT ${returnFields} FROM "${doctype?.name}" WHERE id = ?`,
      [this.id]
    ) as any;
    return returned;
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
      "Cancel",
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
    return this._cancel().then(resolve).catch(reject);
  }

  catch(reject: (reason: any) => void) {
    return this._cancel().catch(reject);
  }
}
