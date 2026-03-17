import { z } from "bxo";

const orgInfoSchema = z.object({
  id: z.string(),
  organization_name: z.string().nullable(),
  unique_name: z.string().nullable(),
  abbr: z.string().nullable(),
  logo: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  bio: z.string().nullable(),
  facebook_url: z.string().nullable(),
  twitter_url: z.string().nullable(),
  linkedin_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
});

export default $action(async (ctx) => {
  const org = (ctx.query as { org?: string }).org;
  if (!org) {
    return ctx.json({ org: null });
  }

  const doc = await $zodula.doctype("Organization").get(org as any).bypass(true).fields([
    "id",
    "organization_name",
    "unique_name",
    "abbr",
    "logo",
    "address",
    "phone",
    "email",
    "website",
    "bio",
    "facebook_url",
    "twitter_url",
    "linkedin_url",
    "instagram_url",
    "youtube_url",
  ] as any);
  if (!doc?.id) {
    return ctx.json({ org: null });
  }

  return ctx.json({ org: doc });
}, {
  method: "GET",
  query: z.object({
    org: z.string().min(1),
  }),
  response: {
    200: z.object({
      org: orgInfoSchema.nullable(),
    }),
  },
});
