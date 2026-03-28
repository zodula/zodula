import { z } from "bxo";
import { runDeskSearch } from "./desk-search-shared";

export default $action(
  async (ctx) => {
    const qRaw = String(ctx.body?.q ?? "").trim();
    if (!qRaw) {
      return ctx.json(
        { doctypes: [], pages: [], docs: [] },
        400
      );
    }
    const { status, body } = await runDeskSearch(qRaw, {
      docsOnly: true,
    });
    if (status === 401) {
      return ctx.json(body, 401);
    }
    return ctx.json(body);
  },
  {
    body: z.object({
      q: z.string().min(1),
    }),
    response: {
      200: z.object({
        doctypes: z.array(
          z.object({
            name: z.string(),
            label: z.string(),
            listHref: z.string(),
          })
        ),
        pages: z.array(
          z.object({
            name: z.string(),
            href: z.string(),
          })
        ),
        docs: z.array(
          z.object({
            doctype: z.string(),
            doctypeLabel: z.string(),
            name: z.string(),
            formHref: z.string(),
          })
        ),
      }),
    },
  }
);
