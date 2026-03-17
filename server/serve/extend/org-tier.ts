import BXO from "bxo";
import { zodula } from "../..";

export const OrgTier = () => {
  const bxo = new BXO();

  bxo.beforeRequest(async (ctx: any) => {
    const org = ctx.headers?.get("x-organization");
    if (!org) return ctx;

    const orgDoc = await zodula.doctype("Organization").get(org).bypass(true);
    if (!orgDoc?.id) return ctx;

    const items = await zodula
      .doctype("Organization App Tier Item")
      .select()
      .where("parentid", "=", orgDoc.id)
      .where("parentype", "=", "Organization")
      .where("parentfield", "=", "organization_app_tier_items")
      .bypass(true);

    const now = new Date();
    for (const item of items.docs || []) {
      if (item.tier_level === "0") continue;
      const expiresAt = item.expires_at ? zodula.utils.parseDate(item.expires_at) : null;
      if (expiresAt && expiresAt < now) {
        await zodula
          .doctype("Organization App Tier Item")
          .update(item.id, { tier_level: "0", expires_at: null })
          .bypass(true)
          .catch((error) => console.error("Error updating organization app tier item", error));
      }
    }
  });

  return bxo;
};
