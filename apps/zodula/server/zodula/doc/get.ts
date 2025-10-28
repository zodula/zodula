import { ErrorWithCode } from "@/zodula/error";
import { Database } from "../../database/database";
import { loader } from "../../loader";
import {
  SUFFIX_EXTEND,
  SUFFIX_REF_TABLE,
  type DoctypeRelative,
} from "../../loader/plugins/doctype";
import { ZodulaSession } from "../session";
import { ZodulaDoctypeHelper, type GETOptions } from "./helper";
import { zodula } from "../..";

export class ZodulaDoctypeGetter<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private doctypeName: TN;
  private id: string;
  private options: GETOptions<TN> = {
    fields: [] as any[],
    bypass: false,
    override: false,
    unsafe: false,
  };

  constructor(doctypeName: TN, id: string) {
    this.doctypeName = doctypeName;
    this.id = id;
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN> | "*")[]) {
    this.options.fields = fields as any[];
    return this;
  }

  unsafe(unsafe: boolean = true) {
    this.options.unsafe = unsafe;
    return this;
  }

  bypass(bypass: boolean = true) {
    this.options.bypass = bypass;
    return this;
  }

  private async _get() {
    try {
      const db = Database("main");
      const doctype = loader.from("doctype").get(this.doctypeName);
      const relatives = doctype.relatives;
      const session = new ZodulaSession();
      if (!this.options.bypass) {
        const user = await session.user(true);
        const old = (await db.get(
          `SELECT * FROM "${doctype?.name}" WHERE "id" = '${this.id}'`
        )) as any;
        const roles = await zodula.session.roles();
        const { can, userPermissionCan } =
          await ZodulaDoctypeHelper.checkPermission(
            this.doctypeName,
            "can_select",
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
            `You do not have permission to get ${this.doctypeName}/${this.id}`,
            {
              status: 403,
            }
          );
        }

        if (!userPermissionCan) {
          throw new ErrorWithCode(
            `You do not have User Permission to get ${this.doctypeName} document with id ${this.id}.`,
            {
              status: 403,
            }
          );
        }
      }
      const fields =
        this.options.fields.length > 0
          ? this.options.fields
              ?.map((field) => String(field))
              .filter(
                (field) =>
                  !relatives.some((relative) => relative.alias === field)
              )
          : ["*"];
      const result = (await db.get(
        `SELECT ${fields.join(",")} FROM "${doctype?.name}" WHERE "id" = '${this.id}'`
      )) as any;
      if (relatives.length > 0 && result) {
        for (const relative of relatives.filter(
          (relative) => relative.type !== "Reference"
        )) {
          const relativeRecords = await ZodulaDoctypeHelper.getRelativeRecords(
            this.id,
            relative,
            this.options
          );
          // let relativeRecords = undefined
          // if (relative.type === "One to One") {
          //     relativeRecords = await zodula.doctype(relative.childDoctype).get(this.id).bypass(this.options.bypass)
          // } else if (relative.type === "One to Many") {
          //     relativeRecords = (await zodula.doctype(relative.childDoctype).select().where(relative.childFieldName as any, "=", this.id).bypass(this.options.bypass)).docs
          // }
          const relativeFieldAlias =
            relative.alias ||
            `${relative.childDoctype}${relative.type === "One to Many" ? SUFFIX_REF_TABLE : SUFFIX_EXTEND}`;
          if (relativeRecords !== undefined) {
            result[relativeFieldAlias] = relativeRecords;
          }
        }
      }
      return this.options.unsafe
        ? result
        : ZodulaDoctypeHelper.formatDocResult(result, doctype.schema);
    } catch (error) {
      throw error;
    }
  }

  then(
    resolve: (value: Zodula.SelectDoctype<TN>) => void,
    reject: (reason: any) => void
  ) {
    return this._get().then(resolve, reject);
  }

  catch(reject: (reason: any) => void) {
    return this._get().catch(reject);
  }
}
