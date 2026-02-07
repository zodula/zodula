import BXO from "bxo";
import { zodula } from "../..";
import { ctxContext } from "../../async-context";

export const OrgTier = () => {
  const bxo = new BXO();

  bxo.beforeRequest(async (ctx: any) => {
    const org = ctx.headers?.get("x-organization");
    if (!!org) {
      const orgDoc = await zodula.doctype("zodula__Organization").get(org).bypass(true);
      const tierLevel = Number(orgDoc?.tier_level || '0') || 0;
      if (tierLevel > 0 && orgDoc.tier_expires_at) {
        const tierExpiresAt = zodula.utils.parseDate(orgDoc.tier_expires_at);
        if (!!tierExpiresAt && tierExpiresAt! < new Date()) {
        await zodula
            .doctype("zodula__Organization")
            .update(org, {
              tier_expires_at: null,
              tier_level: "0",
            })
            .bypass(true).catch((error) => {
              console.error("Error updating organization tier", error);
            });
        }
      }
    }
  });

  return bxo;
};
