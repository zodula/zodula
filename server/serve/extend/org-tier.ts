import BXO from "bxo";
import { zodula } from "../..";
import { ctxContext } from "../../async-context";

export const OrgTier = () => {
  const bxo = new BXO();

  bxo.beforeRequest(async (ctx: any) => {
    const org = ctx.headers?.get("x-organization");
    if (!!org) {
      let orgDoc = await zodula.doctype("Organization").get(org).bypass(true);
      let tierLevel = Number(orgDoc?.tier_level || '0') || 0;
      if(!orgDoc){
        return ctx;
      }
      if(!orgDoc?.tier_level){
        orgDoc = await zodula.doctype("Organization").update(org, {
          tier_level: "0",
        }).bypass(true);
        tierLevel = 0;
      }
      if (tierLevel > 0 && orgDoc.tier_expires_at) {
        const tierExpiresAt = zodula.utils.parseDate(orgDoc.tier_expires_at);
        if (!!tierExpiresAt && tierExpiresAt! < new Date()) {
        await zodula
            .doctype("Organization")
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
