import { z } from "bxo";
import { normalizeOrgAdditionalMenu } from "./additionalMenuPublic";

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
  additional_menu: z.array(z.object({ label: z.string(), url: z.string() })),
});

export default $action(async (ctx) => {
  const doc = await $zodula.doctype("Organization").get("Organization").bypass(true).fields([
    "id",
    "organization_name",
    "abbr",
    "address",
    "phone",
    "email",
    "website",
    "bio",
  ] as any);

  const globalSetting = await $zodula
    .doctype("Global Setting")
    .get("Global Setting")
    .bypass(true)
    .fields([
      "currency",
      "is_setup",
      "logo",
      "facebook_url",
      "twitter_url",
      "linkedin_url",
      "instagram_url",
      "youtube_url",
    ] as any);

  if (!doc?.id) {
    return ctx.json({ org: null });
  }

  return ctx.json({
    org: {
      ...doc,
      currency: (globalSetting as any)?.currency ?? null,
      is_setup: (globalSetting as any)?.is_setup ?? null,
      logo: (globalSetting as any)?.logo ?? null,
      facebook_url: (globalSetting as any)?.facebook_url ?? null,
      twitter_url: (globalSetting as any)?.twitter_url ?? null,
      linkedin_url: (globalSetting as any)?.linkedin_url ?? null,
      instagram_url: (globalSetting as any)?.instagram_url ?? null,
      youtube_url: (globalSetting as any)?.youtube_url ?? null,
      additional_menu: normalizeOrgAdditionalMenu((doc as any).additional_menu),
    },
  });
}, {
  method: "GET",
  response: {
    200: z.object({
      org: orgInfoSchema.nullable(),
    }),
  },
});
