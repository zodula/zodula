import { FieldHelper } from "@/zodula/server/field";
import { loader } from "@/zodula/server/loader";
import type { DoctypeMetadata } from "@/zodula/server/loader/plugins/doctype";
import BXO, { z, type RouteSchema } from "bxo";
import { ctxContext, dbcontext } from "@/zodula/server/async-context";
import { zodula } from "@/zodula/server/zodula";
import { Database } from "../../database/database";
import { ErrorWithCode } from "@/zodula/error";

class DoctypeAPIHelper {
  static parseFilters(filterQuery?: Array<[string, string, string]>) {
    const filters: Array<[string, string, any]> = [];

    for (const _filter of filterQuery || []) {
      try {
        let filter = JSON.parse(_filter as unknown as string);
        filters.push([filter[0], filter[1], filter[2]]);
      } catch (error) {}
    }

    return filters;
  }

  static parseFiltersFromObject(rest: Record<string, any>) {
    const filters: Array<[string, string, any]> = [];

    // Extract filter indices from keys like "filters[0][0]", "filters[0][1]", etc.
    const filterIndices = new Set<number>();

    for (const key of Object.keys(rest)) {
      const match = key.match(/^filters\[(\d+)\]\[(\d+)\]/);
      if (match) {
        filterIndices.add(parseInt(match[1] || "0"));
      }
    }

    // Build filters from the indexed data
    for (const index of filterIndices) {
      const field = rest[`filters[${index}][0]`];
      const operator = rest[`filters[${index}][1]`];

      // Check if the value is an array by looking for keys like "filters[index][2][0]", "filters[index][2][1]", etc.
      const valueKeys = Object.keys(rest).filter((key) =>
        key.match(new RegExp(`^filters\\[${index}\\]\\[2\\]\\[\\d+\\]$`))
      );

      let value: any;
      if (valueKeys.length > 0) {
        // Value is an array - collect all array elements
        const arrayValues: any[] = [];
        for (const valueKey of valueKeys) {
          const arrayIndexMatch = valueKey.match(
            /^filters\[\d+\]\[2\]\[(\d+)\]$/
          );
          if (arrayIndexMatch) {
            const arrayIndex = parseInt(arrayIndexMatch[1] || "0");
            arrayValues[arrayIndex] = rest[valueKey];
          }
        }
        // Remove undefined values and keep the array structure
        value = arrayValues.filter((v) => v !== undefined);
      } else {
        // Value is a simple value
        value = rest[`filters[${index}][2]`];
      }

      if (field && operator && value !== undefined) {
        filters.push([field, operator, value]);
      }
    }

    return filters;
  }

  static getListRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      query: z
        .object({
          fields: z.array(z.string()).optional(),
          limit: z.string().optional(),
          page: z.string().optional(),
          sort: z.string().optional(),
          order: z.string().optional(),
          filters: z.any().optional(),
          q: z.string().optional(),
        })
        .passthrough(),
      response: {
        200: z.object({
          count: z.number(),
          page: z.number(),
          limit: z.number(),
          docs: z.array(FieldHelper.doctypeToZod(doctype).partial()),
        }),
      },
      detail: {
        contentType: "application/json",
        summary: `List ${metadata.name}`,
        description: `List ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
  static getSingleRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    const responseSchema = FieldHelper.doctypeToZod(doctype);
    return {
      response: {
        200: responseSchema,
      },
      detail: {
        contentType: "application/json",
        summary: `Get ${metadata.name}`,
        description: `Get ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
  static getCreateRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      body: FieldHelper.doctypeToZod(doctype, {
        withOutStandardFields: true,
      }).partial(),
      query: z
        .object({
          fields: z.array(z.string()).optional(),
        })
        .passthrough(),
      detail: {
        defaultContentType: "application/json",
        summary: `Create ${metadata.name}`,
        description: `Create ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
  static getDeleteRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      detail: {
        contentType: "application/json",
        summary: `Delete ${metadata.name}`,
        description: `Delete ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
  static getBulkCreateRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      body: z.object({
        docs: z.array(FieldHelper.doctypeToZod(doctype)),
      }),
      detail: {
        contentType: "application/json",
        summary: `Bulk Create ${metadata.name}`,
        description: `Bulk Create ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }

  static getUpdateRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      body: FieldHelper.doctypeToZod(doctype, { withOutStandardFields: true })
        .passthrough()
        .partial(),
      query: z
        .object({
          fields: z.array(z.string()).optional(),
        })
        .passthrough(),
      detail: {
        contentType: "application/json",
        summary: `Update ${metadata.name}`,
        description: `Update ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
  static getBulkDeleteRouteConfig(metadata: DoctypeMetadata) {
    const doctype = metadata.schema;
    return {
      body: z.object({
        ids: z.array(z.string()),
      }),
      detail: {
        contentType: "application/json",
        summary: `Bulk Delete ${metadata.name}`,
        description: `Bulk Delete ${metadata.name}`,
        tags: [`Doctype: ${metadata.name}`],
      },
    } satisfies RouteSchema;
  }
}

export const extendDoctype = () => {
  const server = new BXO();
  const doctypeMetas = loader.from("doctype").list();
  for (const doctypeMeta of doctypeMetas) {
    const isSingle = doctypeMeta.schema.is_single;
    // get single doc
    server.get(
      `/api/resources/${doctypeMeta.name}${isSingle ? "" : "/:id"}`,
      async (ctx) => {
        try {
          ctxContext.enterWith({
            ctx: ctx as any,
          });
          const docid = !!isSingle ? doctypeMeta.name : (ctx as any).params.id;
          const db = Database("main");

          return await db.transaction(async (trx) => {
            dbcontext.enterWith({
              trx: trx,
            });
            const isExist = await trx
              .select()
              .from(doctypeMeta.name)
              .where("id", "=", docid)
              .first();
            if (!isExist && isSingle) {
              await zodula
                .doctype(doctypeMeta.name)
                .insert({
                  id: docid,
                })
                .bypass()
                .override();
            }
            const result = await zodula
              .doctype(doctypeMeta.name)
              .get(docid)
              .fields((ctx.query.fields || ["*"]) as any[]);

            if (!isExist && !isSingle) {
              return ctx.json(
                {
                  error: "Document not found",
                },
                404
              );
            }
            return ctx.json(result);
          });
        } catch (error: any) {
          return ctx.json(
            error?.message || "Internal server error",
            error?.status || 500
          );
        }
      },
      DoctypeAPIHelper.getSingleRouteConfig(doctypeMeta)
    );

    // single create doc
    !isSingle &&
      server.post(
        `/api/resources/${doctypeMeta.name}/new`,
        async (ctx) => {
          try {
            ctxContext.enterWith({
              ctx: ctx as any,
            });
            const input = await ctx.body;
            const result = await zodula
              .doctype(doctypeMeta.name)
              .insert(input)
              .fields(ctx.query.fields || (["*"] as any[]));
            return ctx.json(result);
          } catch (error: any) {
            return ctx.json(
              {
                error: error?.message || "Internal server error",
              },
              error?.status || 500
            );
          }
        },
        DoctypeAPIHelper.getCreateRouteConfig(doctypeMeta)
      );

    // update doc
    server.put(
      `/api/resources/${doctypeMeta.name}${isSingle ? "" : "/:id"}`,
      async (ctx) => {
        try {
          ctxContext.enterWith({
            ctx: ctx as any,
          });
          const db = Database("main");
          return await db.transaction(async (trx) => {
            dbcontext.enterWith({
              trx: trx,
            });
            const docid = isSingle ? doctypeMeta.name : (ctx as any).params.id;
            const input = ctx.body;
            const result = await zodula
              .doctype(doctypeMeta.name)
              .update(docid, input)
              .fields(ctx.query.fields || (["*"] as any[]));
            return ctx.json(result);
          });
        } catch (error: any) {
          return ctx.json(
            {
              error: error?.message || "Internal server error",
            },
            error?.status || 500
          );
        }
      },
      DoctypeAPIHelper.getUpdateRouteConfig(doctypeMeta)
    );

    // delete doc
    !isSingle &&
      server.delete(
        `/api/resources/${doctypeMeta.name}/${isSingle ? "" : ":id"}`,
        async (ctx) => {
          try {
            ctxContext.enterWith({
              ctx: ctx as any,
            });
            const db = Database("main");
            return await db.transaction(async (trx) => {
              dbcontext.enterWith({
                trx: trx,
              });
              const docid = isSingle
                ? doctypeMeta.name
                : (ctx as any).params.id;
              const result = await zodula
                .doctype(doctypeMeta.name)
                .delete(docid);
              return ctx.json(result);
            });
          } catch (error: any) {
            return ctx.json(
              {
                error: error?.message || "Internal server error",
              },
              error?.status || 500
            );
          }
        },
        DoctypeAPIHelper.getDeleteRouteConfig(doctypeMeta)
      );

    // list docs
    !isSingle &&
      server.get(
        `/api/resources/${doctypeMeta.name}`,
        async (ctx) => {
          try {
            const {
              limit = "20",
              page = "1",
              sort = "updated_at",
              order = "asc",
              q,
              fields,
              ...rest
            } = ctx.query;
            const doctypeName = doctypeMeta.name;
            ctxContext.enterWith({
              ctx: ctx as any,
            });

            const db = Database("main");
            return await db.transaction(async (trx) => {
              dbcontext.enterWith({
                trx: trx,
              });
              let query = zodula
                .doctype(doctypeName)
                .select()
                .limit(+limit)
                .page(+page)
                .sort(sort as any, order as "asc" | "desc")
                .q(q as string)
                .fields(fields || (["*"] as any[]));

              if (rest) {
                const filters = DoctypeAPIHelper.parseFiltersFromObject(rest);
                for (const [field, operator, value] of filters) {
                  query = query.where(field as any, operator as any, value);
                }
              }

              const result = await query;
              return ctx.json({
                docs: result.docs,
                limit: result.limit,
                page: result.page,
                count: result.count,
              });
            });
          } catch (error: any) {
            return ctx.json(
              {
                error: error?.message || "Internal server error",
              },
              error?.status || 500
            );
          }
        },
        DoctypeAPIHelper.getListRouteConfig(doctypeMeta)
      );

    // bulk create docs
    !isSingle &&
      server.post(
        `/api/resources/${doctypeMeta.name}`,
        async (ctx) => {
          try {
            ctxContext.enterWith({
              ctx: ctx as any,
            });
            const db = Database("main");
            return await db.transaction(async (trx) => {
              dbcontext.enterWith({
                trx: trx,
              });
              const input = await ctx.body;
              let result: Zodula.SelectDoctype<typeof doctypeMeta.name>[] = [];
              for (const item of input.docs || []) {
                const res = await zodula.doctype(doctypeMeta.name).insert({
                  ...item,
                  id: item.id as string,
                });
                result.push(res);
              }
              return ctx.json(result);
            });
          } catch (error: any) {
            return ctx.json(
              {
                error: error?.message || "Internal server error",
              },
              error?.status || 500
            );
          }
        },
        DoctypeAPIHelper.getBulkCreateRouteConfig(doctypeMeta)
      );

    // bulk delete docs
    !isSingle &&
      server.delete(
        `/api/resources/${doctypeMeta.name}`,
        async (ctx) => {
          try {
            ctxContext.enterWith({
              ctx: ctx as any,
            });
            const db = Database("main");
            return await db.transaction(async (trx) => {
              dbcontext.enterWith({
                trx: trx,
              });
              const input = await ctx.body;
              for (const id of input.ids) {
                await zodula.doctype(doctypeMeta.name).delete(id);
              }
              return ctx.json({
                success: true,
              });
            });
          } catch (error: any) {
            return ctx.json(
              {
                error: error?.message || "Internal server error",
              },
              error?.status || 500
            );
          }
        },
        DoctypeAPIHelper.getBulkDeleteRouteConfig(doctypeMeta)
      );
  }
  return server;
};
