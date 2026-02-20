import { ErrorWithCode } from "@/zodula/error";
import { Database } from "../../database/database";
import { loader } from "../../loader";
import {
  SUFFIX_EXTEND,
  SUFFIX_REF_TABLE,
  type DoctypeRelative,
  type DoctypeChild,
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
      const children = doctype.children;
      const session = new ZodulaSession();
      const organization = await session.organization(true);
      const isGlobal = doctype.config.is_global === 1;
      if (!this.options.bypass) {
        const user = await session.user(true);
        const old = (await db.get(
          `SELECT * FROM "${doctype?.name}" WHERE "id" = '${this.id}' AND (${isGlobal ? "1=1" : `("organization" = "${organization}" OR "organization" = "System Panel")`})`    
        )) as any;

        const { can } =
          await ZodulaDoctypeHelper.checkPermission(
            this.doctypeName,
            "can_get",
            old,
            {
              bypass: this.options.bypass,
              doctype,
            }
          );

        if (
          !can &&
          !["Organization", "Organization Role"].includes(
            this.doctypeName
          )
        ) {
          throw new ErrorWithCode(
            `You do not have permission to get ${this.doctypeName}/${this.id}`,
            {
              status: 403,
            }
          );
        }
      }
      // Find child field aliases from children (Reference Table and Extend fields)
      const childFieldAliases = new Set<string>()
      for (const child of children) {
        childFieldAliases.add(child.parentFieldName);
      }

      const fields =
        this.options?.fields?.length > 0
          ? this.options?.fields
              ?.map?.((field) => String(field))
              ?.filter(
                (field) => !childFieldAliases.has(field)
              ) ?? []
          : ["*"];
      let result = (await db.get(
        `SELECT ${fields.join(",")} FROM "${doctype?.name}" WHERE "id" = '${this.id}'`
      )) as any;

      if (children.length > 0 && result) {
        for (const child of children) {
          const relativeRecords = await ZodulaDoctypeHelper.getChildRecords(
            this.id,
            child,
            this.options
          );

          if (relativeRecords !== undefined) {
            result[child.parentFieldName] = relativeRecords;
          }
        }
      }

      // Apply permission level permissions to filter fields
      if (!this.options.bypass && result) {
        const roles = await zodula.session.roles();
        const user = await session.user(true);
        const isOwn = result.owner === user.id;
        result = await ZodulaDoctypeHelper.applyPermLevelPermission(
          this.doctypeName,
          result,
          roles,
          this.options.bypass,
          isOwn
        );
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
