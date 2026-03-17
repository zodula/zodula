export default $doctype<"App Tier Payment Request">({
    organization: {
        type: "Reference",
        label: "Organization",
        reference: "Organization",
        required: 1
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1
    },
    tier_level: {
        type: "Select",
        label: "Tier Level",
        options: "0\n1\n2\n3\n4\n5",
        required: 1,
        default: "0"
    },
    duration: {
        type: "Integer",
        label: "Duration",
        required: 1,
        default: "1"
    },
    duration_unit: {
        type: "Select",
        label: "Duration Unit",
        options: "Month\nYear",
        required: 1,
        default: "Month"
    },
    proof_of_payment: {
        type: "File",
        label: "Proof of Payment",
        accept: "image/*"
    }
}, {
    label: "App Tier Payment Request",
    is_submittable: 1,
    naming_series: "ATPR-{{doc_organization_abbr}}-{#####}",
})
    .on("before_submit", async ({ doc }) => {
        const appId = doc.app;
        const tierLevel = (String(doc.tier_level ?? "0") || "0") as "0" | "1" | "2" | "3" | "4" | "5";
        if (!appId) return;
        const configs = await $zodula.doctype("App Tier Config")
            .select()
            .where("app", "=", appId)
            .where("tier_level", "=", tierLevel)
            .bypass(true);
        const config = configs.docs?.[0];
        if (!config) throw new Error(`No tier config found for this App and Tier Level.`);
        if (Number(config.enabled) === 0) throw new Error(`This package (tier) is not enabled for payment.`);
    })
    .on("after_submit", async ({ doc }) => {
        const orgName = doc.organization;
        const appId = doc.app;
        if (!orgName || !appId) throw new Error("Organization and App are required");
        const tierLevel = String(doc.tier_level || "0") as "0" | "1" | "2" | "3" | "4" | "5";
        const duration = Number(doc.duration) || 1;
        const durationUnit = doc.duration_unit === "Year" ? "years" : "months";

        const orgDoc = await $zodula.doctype("Organization").get(orgName).bypass(true);
        if (!orgDoc?.id) throw new Error("Organization not found");

        const now = new Date();
        const expiresAt = durationUnit === "years"
            ? $zodula.date.add(now, duration, "years")
            : $zodula.date.add(now, duration, "months");
        const expiresAtStr = $zodula.utils.format(expiresAt, "date");

        const existing = await $zodula.doctype("Organization App Tier Item")
            .select()
            .where("parentid", "=", orgDoc.id)
            .where("parentype", "=", "Organization")
            .where("parentfield", "=", "organization_app_tier_items")
            .where("app", "=", appId)
            .bypass(true);

        if (existing.count > 0 && existing.docs?.[0]) {
            await $zodula.doctype("Organization App Tier Item")
                .update(existing.docs[0].id!, { tier_level: tierLevel, expires_at: expiresAtStr })
                .bypass(true);
        } else {
            await $zodula.doctype("Organization App Tier Item")
                .insert({
                    parentid: orgDoc.id,
                    parentype: "Organization",
                    parentfield: "organization_app_tier_items",
                    app: appId,
                    tier_level: tierLevel,
                    expires_at: expiresAtStr,
                    organization: orgName,
                } as any)
                .bypass(true);
        }
    });
