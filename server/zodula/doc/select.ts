import { ErrorWithCode } from "@/zodula/error";
import { Database } from "../../database/database";
import { loader } from "../../loader";
import { ZodulaSession } from "../session";
import type {
  BaseOptions,
  IFilter,
  IOperator,
  IOperatorValue,
  ServerSideInsertOptions,
  ServerSideSelectOptions,
} from "../type";
import { ZodulaDoctypeHelper } from "./helper";
import type { DoctypeMetadata } from "../../loader/plugins/doctype";
import { zodula } from "../..";

export class ZodulaDoctypeSelector<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private options = {
    filters: [] as IFilter<TN, keyof Zodula.InsertDoctype<TN>, IOperator>[],
    limit: 1000000,
    page: 1,
    sort: "" as keyof Zodula.SelectDoctype<TN>,
    order: "asc" as "asc" | "desc",
    bypass: false,
    override: false,
    unsafe: false,
    fields: [] as (keyof Zodula.SelectDoctype<TN> | "*")[],
    q: "",
  };

  private session: ZodulaSession = new ZodulaSession();

  constructor(private doctypeName: TN) {
    this.doctypeName = doctypeName;
  }

  limit(limit: number) {
    this.options.limit = limit;
    return this;
  }

  page(page: number) {
    this.options.page = page;
    return this;
  }

  where<F extends keyof Zodula.SelectDoctype<TN>, O extends IOperator>(
    field: F,
    operator: O,
    value: IOperatorValue<TN, F, O>
  ) {
    let _value = value;
    this.options.filters.push([field, operator, _value] as any);
    return this;
  }

  sort(sort: keyof Zodula.SelectDoctype<TN>, order: "asc" | "desc") {
    this.options.sort = sort;
    this.options.order = order;
    return this;
  }

  bypass(bypass: boolean = true) {
    this.options.bypass = bypass;
    return this;
  }

  override(override: boolean = true) {
    this.options.override = override;
    return this;
  }

  unsafe(unsafe: boolean = true) {
    this.options.unsafe = unsafe;
    return this;
  }

  q(q: string) {
    this.options.q = q;
    return this;
  }

  fields(fields: (keyof Zodula.SelectDoctype<TN> | "*")[]) {
    this.options.fields = fields;
    return this;
  }

  private buildWhereClause(
    doctype: DoctypeMetadata,
    roles: string[],
    permissions: Zodula.SelectDoctype<"zodula__Doctype Permission">[],
    userPermissions: Zodula.SelectDoctype<"zodula__User Permission">[],
    user: Zodula.SelectDoctype<"zodula__User">
  ): string {
    const { filters = [], q } = this.options;
    const whereConditions: string[] = [];

    // Process regular filters
    for (const filter of filters) {
      const [field, operator, value] = filter;
      let condition = "";

      switch (operator) {
        case "=":
        case "!=":
        case ">":
        case ">=":
        case "<":
        case "<=":
        case "LIKE":
        case "NOT LIKE":
          condition = `"${field as string}" ${operator} '${value}'`;
          break;
        case "IN":
          const arrValue1 = ("(" +
            (value as string[])?.map((v) => `'${v}'`).join(",") +
            ")") as any;
          condition = `"${field as string}" IN ${arrValue1}`;
          break;
        case "NOT IN":
          const arrValue2 = ("(" +
            (value as string[])?.map((v) => `'${v}'`).join(",") +
            ")") as any;
          condition = `"${field as string}" NOT IN ${arrValue2}`;
          break;
        case "IS NULL":
          condition = `"${field as string}" IS ${value === 1 || value === "1" ? "" : "NOT "}NULL`;
          break;
        case "IS NOT NULL":
          condition = `"${field as string}" IS ${value === 1 || value === "1" ? "NOT " : ""}NULL`;
          break;
      }

      if (condition) {
        whereConditions.push(condition);
      }
    }

    // Process search query
    if (q) {
      const searchFields = doctype.config.search_fields
        ? ["id", ...doctype.config.search_fields.split("\n").filter(Boolean)]
        : ["id"];

      const searchConditions = searchFields.map(
        (field: string) => `"${field}" LIKE '%${q}%'`
      );

      if (searchConditions.length > 0) {
        whereConditions.push(`(${searchConditions.join(" OR ")})`);
      }
    }

    let mergePermission = {} as Record<
      string,
      Zodula.SelectDoctype<"zodula__Doctype Permission">
    >;
    for (const permission of permissions) {
      for (const [key, value] of Object.entries(permission)) {
        if (!mergePermission[key] && key.startsWith("can_")) {
          mergePermission[key] = value;
        }
      }
    }
    const { can_select } = mergePermission;
    const { can_own_select } = mergePermission;
    if (
      !can_select &&
      !this.options.bypass &&
      !roles.includes("System Admin")
    ) {
      if (can_own_select) {
        whereConditions.push(`"owner" = "${user?.id}"`);
      } else {
        whereConditions.push(`"id" IS NULL`);
      }
    }

    if (!roles.includes("System Admin") && !this.options.bypass) {
      let orFieldUserPermissionCondition = [] as string[];
      for (const userPermission of userPermissions) {
        for (const [fieldName, field] of Object.entries(
          doctype.schema.fields
        )) {
          if (
            field.type === "Reference" &&
            field.reference === userPermission.allow &&
            (userPermission.apply_to_all === 1 ||
              userPermission.apply_to_only === doctype.name)
          ) {
            orFieldUserPermissionCondition.push(
              `"${fieldName}" = "${userPermission.value}"`
            );
          }
        }
      }

      if (orFieldUserPermissionCondition.length > 0) {
        whereConditions.push(
          `(${orFieldUserPermissionCondition.join(" OR ")})`
        );
      } else {
        if (doctype.config.require_user_permission === 1) {
          whereConditions.push(`"id" IS NULL`);
        }
      }

      // check for parent user permission
      let orDoctypeUserPermissionCondition = [] as string[];
      for (const userPermission of userPermissions) {
        if (
          userPermission.allow === doctype.name &&
          (userPermission.apply_to_all === 1 ||
            userPermission.apply_to_only === doctype.name)
        ) {
          orDoctypeUserPermissionCondition.push(
            `"id" = "${userPermission.value}"`
          );
        }
      }

      if (orDoctypeUserPermissionCondition.length > 0) {
        whereConditions.push(
          `(${orDoctypeUserPermissionCondition.join(" OR ")})`
        );
      } else {
        if (doctype.config.require_user_permission === 1) {
          whereConditions.push(`"id" IS NULL`);
        }
      }
    }

    const result =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    return result;
  }

  async _select() {
    try {
      const db = Database("main");
      const doctype = loader.from("doctype").get(this.doctypeName);
      const session = new ZodulaSession();
      const user = await session.user(true);

      const roles = await session.roles();
      const permissions = await ZodulaDoctypeHelper.getPermissions(
        this.doctypeName,
        roles
      );
      const userPermissions = await ZodulaDoctypeHelper.getUserPermissions(
        user.id
      );
      if (
        permissions?.every(
          (permission) =>
            permission.can_select !== 1 && permission.can_own_select !== 1
        ) &&
        !this.options.bypass &&
        !roles?.includes("System Admin")
      ) {
        throw new ErrorWithCode(
          `You do not have permission to select ${this.doctypeName}`,
          {
            status: 403,
          }
        );
      }
      const { limit = 1000000, page = 1 } = this.options || {};
      const fields =
        this.options.fields.length > 0
          ? this.options.fields?.map((field) => String(field))
          : ["*"];

      // Build the main query
      const selectClause = `SELECT ${fields.join(",")} FROM "${doctype?.name}"`;
      const whereClause = this.buildWhereClause(
        doctype,
        roles,
        permissions,
        userPermissions,
        user
      );
      const orderClause = this.options.sort
        ? `ORDER BY "${this.options.sort as string}" ${this.options.order}`
        : "";
      const limitClause = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

      // Combine all clauses
      const queryParts = [
        selectClause,
        whereClause,
        orderClause,
        limitClause,
      ].filter(Boolean);
      const stmt = queryParts.join(" ");

      // Execute query
      const result = (await db.all(
        stmt
      )) as unknown as Zodula.SelectDoctype<TN>[];

      // Build count query for pagination
      const countQueryParts = [
        `SELECT COUNT(*) as count FROM "${doctype?.name}"`,
        whereClause,
      ].filter(Boolean);
      const countStmt = countQueryParts.join(" ");
      const count = +(await db.get(countStmt))?.count as number;

      let results = [] as Zodula.SelectDoctype<TN>[];

      if (
        this.doctypeName === "zodula__Doctype" &&
        !this.options.bypass &&
        !roles.includes("System Admin")
      ) {
        for (const doctypeDoc of result) {
          const { can, userPermissionCan } =
            await ZodulaDoctypeHelper.checkPermission(
              doctypeDoc.id as any,
              "can_select",
              doctypeDoc,
              {
                bypass: this.options.bypass,
                doctype: doctypeDoc,
                user,
                roles,
              }
            );
          if (!!can || !!userPermissionCan) {
            results.push(
              this.options.unsafe
                ? doctypeDoc
                : (zodula.utils.safe(
                    this.doctypeName,
                    doctypeDoc
                  ) as Zodula.SelectDoctype<TN>)
            );
          }
        }
      } else {
        results = result.map((doc) => {
          return this.options.unsafe
            ? doc
            : zodula.utils.safe(this.doctypeName, doc);
        }) as Zodula.SelectDoctype<TN>[];
      }

      return {
        docs: results,
        limit: limit,
        page: page,
        count: count as number,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // thenable
  then(
    resolve: (value: {
      docs: Zodula.SelectDoctype<TN>[];
      limit: number;
      page: number;
      count: number;
    }) => void,
    reject: (reason: any) => void
  ) {
    return this._select().then(resolve, reject);
  }

  catch(reject: (reason: any) => void) {
    return this._select().catch(reject);
  }
}
