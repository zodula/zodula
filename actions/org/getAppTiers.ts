import { z } from "bxo";

export default $action(async (ctx) => {
  const { organization } = ctx.body as { organization: string };
  if (!organization) {
    return ctx.json({ items: [] }, 400);
  }

  const user = await $zodula.session.user();
  if (!user) return ctx.json({ items: [] }, 403);

  const orgDoc = await $zodula.doctype("Organization").get(organization).bypass(true);
  if (!orgDoc?.id) return ctx.json({ items: [] });

  const appTierConfigsRes = await $zodula.doctype("App Tier Config").select().bypass(true);
  const configs = appTierConfigsRes.docs || [];
  const appIdsWithConfig = [...new Set(configs.map((c: { app: string }) => c.app))];

  const orgTierItemsRes = await $zodula.doctype("Organization App Tier Item")
    .select()
    .where("parentid", "=", orgDoc.id)
    .where("parentype", "=", "Organization")
    .where("parentfield", "=", "organization_app_tier_items")
    .bypass(true);

  const now = new Date();
  const orgTierByApp: Record<string, { tier_level: string; expires_at?: string | null }> = {};
  for (const item of orgTierItemsRes.docs || []) {
    const expiresAt = item.expires_at ? $zodula.utils.parseDate(item.expires_at) : null;
    if (!expiresAt || expiresAt >= now) {
      orgTierByApp[item.app] = { tier_level: String(item.tier_level ?? "0"), expires_at: item.expires_at };
    } else {
      orgTierByApp[item.app] = { tier_level: "0", expires_at: item.expires_at };
    }
  }

  const items: { appName: string; packageName: string }[] = [];

  for (const appId of appIdsWithConfig) {
    let appName: string;
    try {
      const appDoc = await $zodula.doctype("App").get(appId).bypass(true);
      appName = appDoc?.name ?? appId;
    } catch {
      appName = appId;
    }

    const orgTier = orgTierByApp[appId];
    const tierLevel = orgTier ? orgTier.tier_level : "0";

    let packageName: string;
    try {
      const configRes = await $zodula.doctype("App Tier Config")
        .select()
        .where("app", "=", appId)
        .where("tier_level", "=", tierLevel)
        .bypass(true);
      const configDoc = configRes.docs?.[0];
      const pkg = configDoc?.package_name ?? null;
      packageName = pkg ?? `Unknown [${tierLevel}]`;
    } catch {
      packageName = `Unknown [${tierLevel}]`;
    }

    items.push({ appName, packageName });
  }

  return ctx.json({ items });
}, {
  body: z.object({
    organization: z.string().min(1),
  }),
  response: {
    200: z.object({
      items: z.array(z.object({
        appName: z.string(),
        packageName: z.string(),
      })),
    }),
  },
});
