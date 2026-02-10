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
import type { DoctypeChild, DoctypeMetadata } from "../../loader/plugins/doctype";
import { zodula } from "../..";

export class ZodulaDoctypeSelector<
  TN extends Zodula.DoctypeName = Zodula.DoctypeName,
> {
  private options = {
    filters: [] as IFilter<TN, keyof Zodula.InsertDoctype<TN>, IOperator>[],
    limit: -1,
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

  /**
   * Parse field path to detect reference table fields (e.g., "items.unit")
   * Returns { parentField, childField, isReferenceTable } or null if not a reference table field
   */
  private parseReferenceTableField(
    fieldPath: string,
    doctype: DoctypeMetadata
  ): { parentField: string; childField: string; child: DoctypeChild } | null {
    if (!fieldPath || !fieldPath.includes(".")) {
      return null;
    }

    const parts = fieldPath.split(".", 2);
    if (parts.length < 2) {
      return null;
    }

    const [parentField, childField] = parts;
    if (!parentField || !childField) {
      return null;
    }

    const fieldConfig = doctype.schema.fields[parentField];

    if (!fieldConfig || (fieldConfig as any).type !== "Reference Table") {
      return null;
    }

    const childDoctype = (fieldConfig as any).reference as Zodula.DoctypeName;
    if (!childDoctype) {
      return null;
    }

    // Find the child relationship
    const child = doctype.children.find(
      (c) =>
        c.parentDoctype === doctype.name &&
        c.childDoctype === childDoctype &&
        c.type === "Reference Table"
    )

    if (!child) {
      return null;
    }

    return { parentField, childField, child };
  }

  /**
   * Build JOIN clauses for reference table filters
   * Returns { joins: string[], joinAliases: Map<string, string> }
   */
  private buildJoinsForFilters(
    doctype: DoctypeMetadata,
    filters: IFilter<any, any, IOperator>[]
  ): { joins: string[]; joinAliases: Map<string, string> } {
    const joins: string[] = [];
    const joinAliases = new Map<string, string>();
    let joinIndex = 0;

    for (const filter of filters) {
      const [field] = filter;
      const fieldPath = String(field);

      const parsed = this.parseReferenceTableField(fieldPath, doctype);
      if (!parsed) continue;

      const { parentField, child } = parsed;
      const aliasKey = `${parentField}_${child.childDoctype}`;

      // Only add join if we haven't already added it
      if (!joinAliases.has(aliasKey)) {
        const alias = `jt${joinIndex++}`;
        joinAliases.set(aliasKey, alias);

        // Build JOIN: LEFT JOIN child_table AS alias ON alias.child_field = main_table.id
        const joinClause = `LEFT JOIN "${child.childDoctype}" AS "${alias}" ON "${alias}"."parentid" = "${doctype.name}"."id" AND "${alias}"."parentype" = "${doctype.name}" AND "${alias}"."parentfield" = "${parentField}"`;
        joins.push(joinClause);
      }
    }

    return { joins, joinAliases };
  }

  private buildWhereClause(
    doctype: DoctypeMetadata,
    roles: string[],
    permissions: Zodula.SelectDoctype<"zodula__Doctype Permission">[],
    user: Zodula.SelectDoctype<"zodula__User">,
    organization: string | null,
    userOrganizationRoles: string[],
    joinAliases?: Map<string, string>
  ): string {
    const { filters = [], q } = this.options;
    const whereConditions: string[] = [];

    // Process regular filters
    for (const filter of filters) {
      const [field, operator, value] = filter;
      const fieldPath = String(field);
      let condition = "";

      // Check if this is a reference table field
      const parsed = this.parseReferenceTableField(fieldPath, doctype);
      let fieldReference = fieldPath;

      if (parsed && joinAliases) {
        // Use joined table alias for reference table fields
        const { parentField, childField, child } = parsed;
        const aliasKey = `${parentField}_${child.childDoctype}`;
        const alias = joinAliases.get(aliasKey);

        if (alias) {
          fieldReference = `"${alias}"."${childField}"`;
        } else {
          // Fallback to original field path if alias not found
          fieldReference = `"${fieldPath}"`;
        }
      } else {
        // Regular field from main table
        fieldReference = `"${doctype.name}"."${fieldPath}"`;
      }

      switch (operator) {
        case "=":
        case "!=":
        case ">":
        case ">=":
        case "<":
        case "<=":
        case "LIKE":
        case "NOT LIKE":
          condition = `${fieldReference} ${operator} '${value}'`;
          break;
        case "IN":
          const arrValue1 = ("(" +
            (value as string[])?.map((v) => `'${v}'`).join(",") +
            ")") as any;
          condition = `${fieldReference} IN ${arrValue1}`;
          break;
        case "NOT IN":
          const arrValue2 = ("(" +
            (value as string[])?.map((v) => `'${v}'`).join(",") +
            ")") as any;
          condition = `${fieldReference} NOT IN ${arrValue2}`;
          break;
        case "IS NULL":
          condition = `${fieldReference} IS ${value === 1 || value === "1" ? "" : "NOT "}NULL`;
          break;
        case "IS NOT NULL":
          condition = `${fieldReference} IS ${value === 1 || value === "1" ? "NOT " : ""}NULL`;
          break;
      }

      if (condition) {
        whereConditions.push(condition);
      }
    }

    if (doctype.config.is_global !== 1 && organization !== "System Panel" && !this.options.bypass) {
      whereConditions.push(`("${doctype.name}"."organization" = "${organization}" OR "${doctype.name}"."organization" = "System Panel")`);
    }
    if(doctype.name === "zodula__Organization" && !roles.includes("System Admin") && !this.options.bypass) {
      whereConditions.push(`("${doctype.name}"."owner" = "${user?.id}" OR "${doctype.name}"."id" IN ("${userOrganizationRoles.join('","')}"))`);
    }

    // Process search query
    if (q) {
      const searchFields = doctype.config.search_fields
        ? ["id", ...doctype.config.search_fields.split("\n").filter(Boolean)]
        : ["id"];

      const searchConditions = searchFields.map(
        (field: string) => `"${doctype.name}"."${field}" LIKE '%${q}%'`
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
        whereConditions.push(`"${doctype.name}"."owner" = "${user?.id}"`);
      } else {
        whereConditions.push(`"${doctype.name}"."id" IS NULL`);
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
      const organization = await session.organization(true);
      const userOrganizationRoles = await session.organizationRoles(undefined, true);
      const roles = await session.roles();
      const permissions = await ZodulaDoctypeHelper.getPermissions(
        this.doctypeName,
        roles
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

      const { limit = -1, page = 1 } = this.options || {};
      const requestedFields =
        this.options.fields.length > 0
          ? this.options.fields?.map((field) => String(field))
          : ["*"];

      // Build JOINs for reference table filters
      const { joins, joinAliases } = this.buildJoinsForFilters(
        doctype,
        this.options.filters
      );

      // Build SELECT clause with specified fields
      let selectFields: string;
      if (requestedFields.includes("*") || requestedFields.length === 0) {
        // Select all fields
        selectFields = `"${doctype?.name}".*`;
      } else {
        // Ensure "id" is always included (needed for relationships and joins)
        const fieldsToSelect = [...new Set(["id", ...requestedFields])];
        selectFields = fieldsToSelect
          .map((field) => `"${doctype?.name}"."${field}"`)
          .join(", ");
      }

      // Build the main query with JOINs
      const selectClause = `SELECT DISTINCT ${selectFields} FROM "${doctype?.name}"`;
      const joinClause = joins.length > 0 ? joins.join(" ") : "";
      const whereClause = this.buildWhereClause(
        doctype,
        roles,
        permissions,
        user,
        organization || null,
        userOrganizationRoles,
        joinAliases
      );
      const orderClause = this.options.sort
        ? `ORDER BY "${doctype?.name}"."${this.options.sort as string}" ${this.options.order}`
        : "";
      // If limit is -1, fetch all records (no LIMIT/OFFSET clause)
      const limitClause = limit === -1 ? "" : `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;

      // Combine all clauses
      const queryParts = [
        selectClause,
        joinClause,
        whereClause,
        orderClause,
        limitClause,
      ].filter(Boolean);
      const stmt = queryParts.join(" ");
      // Execute query
      const result = (await db.all(
        stmt
      )) as unknown as Zodula.SelectDoctype<TN>[];

      // Build count query for pagination (with DISTINCT if there are JOINs)
      const countSelect = joins.length > 0
        ? `SELECT COUNT(DISTINCT "${doctype?.name}"."id") as count FROM "${doctype?.name}"`
        : `SELECT COUNT(*) as count FROM "${doctype?.name}"`;
      const countQueryParts = [
        countSelect,
        joinClause,
        whereClause,
      ].filter(Boolean);
      const countStmt = countQueryParts.join(" ");
      const count = +(await db.get(countStmt))?.count as number;

      let results = [] as Zodula.SelectDoctype<TN>[];

      results = await Promise.all(
        result.map(async (doc) => {
          // Apply permission level permissions to filter fields
          if (!this.options.bypass && !roles.includes("System Admin")) {
            const isOwn = doc.owner === user.id;
            doc = await ZodulaDoctypeHelper.applyPermLevelPermission(
              this.doctypeName,
              doc,
              roles,
              this.options.bypass,
              isOwn
            );
          }
          return this.options.unsafe
            ? doc
            : zodula.utils.safe(this.doctypeName, doc);
        })
      ) as Zodula.SelectDoctype<TN>[];

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
