import { z } from "bxo";

const orgInfoSchema = z.object({
  id: z.string(),
  organization_name: z.string().nullable(),
  abbr: z.string().nullable(),
  currency: z.string().nullable().optional(),
  is_setup: z.number().nullable().optional(),
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
  const doc = await $zodula.doctype("Organization").get("Organization").bypass(true).fields([
    "id",
    "organization_name",
    "abbr",
    "currency",
    "is_setup",
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
  response: {
    200: z.object({
      org: orgInfoSchema.nullable(),
    }),
  },
});
