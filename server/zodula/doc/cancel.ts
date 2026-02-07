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
  private input: { updated_at?: string } = {};
  private options: CancelOptions = {
    bypass: false,
    fields: [],
  };

  constructor(
    doctypeName: TN,
    private id: string,
    input?: { updated_at?: string }
  ) {
    this.doctypeName = doctypeName;
    if (input) {
      this.input = input;
    }
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
    const { can } =
      await ZodulaDoctypeHelper.checkPermission(
        this.doctypeName,
        "can_cancel",
        old,
        {
          bypass: this.options.bypass,
          doctype,
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
    // Validate updated_at for optimistic locking
    if (this.input.updated_at !== undefined && this.input.updated_at !== old.updated_at) {
      throw new ErrorWithCode(
        `Document has been modified. Please refresh and try again.`,
        { status: 409 }
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
        input: this.input as any,
      });

    // Remove Reference Table and Extend fields before updating
    let mainDocument = { ...prepared };
    Object.keys(mainDocument).forEach((key) => {
      const fieldConfig = doctype.schema.fields[key as keyof Zodula.DoctypeSchema] as any;
      if (fieldConfig?.type === "Reference Table" || fieldConfig?.type === "Extend") {
        delete mainDocument[key as keyof Zodula.SelectDoctype<TN>];
      }
    });

    await this.checkRelatives(doctype, this.id);

    // Update main document
    const result = await this.updateMainDocument(db, doctype, mainDocument);

    // Create audit trail for cancel action
    await this.createAuditTrail(old, result);

    // Execute after cancel trigger
    await loader
      .from("doctype")
      .trigger(this.doctypeName, "after_cancel", {
        old,
        doc: result,
        input: this.input as any,
      });

    return ZodulaDoctypeHelper.formatDocResult<TN>(result, doctype.schema);
  }

  private async checkRelatives(doctype: any, id: string) {
    const connections = await $zodula.utils.getDoctypeConnections(doctype.name, id);
    const submittedDoctypes = [] as { doctype: string, ids: string[] }[]
    for (const connection of connections) {
      let q = $zodula.doctype(connection.doctype as any).select().bypass(true)
      for (const filter of connection.filters) {
        q = q.where(filter[0], filter[1] as any, filter[2])
      }
      const results = await q
      const ids = [] as string[]
      for (const result of results.docs) {
        if (result.doc_status === 1) {
          ids.push(result.id)
        }
      }
      ids?.length > 0 && submittedDoctypes.push({ doctype: connection.doctype, ids: ids })
    }
    if (submittedDoctypes.length > 0) {
      let text = `The following documents are linked to this document and cannot be cancelled:\n`
      for (const submittedDoctype of submittedDoctypes) {
        text += `${submittedDoctype.doctype}\n`
        text += `- ${submittedDoctype.ids.join(", ")}`
      }
      throw new ErrorWithCode(text, { status: 400 })
    }
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

    const returned = await zodula.doctype(this.doctypeName).get(this.id).bypass(true);
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
