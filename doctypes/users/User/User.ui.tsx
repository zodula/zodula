import { zodula } from "@/zodula/client";
import { useZui } from "@/zodula/ui";

async function applyRoleProfile(ctx: any) {
    const roleProfileId = ctx.doc?.role_profile;
    const hasRoleProfile = !!roleProfileId;
    await ctx.set_df_property("roles", "read_only", hasRoleProfile ? 1 : 0);
    if (!hasRoleProfile) {
        return;
    }
    const roleProfile = await zodula.doc.get_doc("Role Profile" as any, roleProfileId as string).catch(() => null);
    const roleRows = (roleProfile?.roles || [])
        .filter((row: any) => row?.role)
        .map((row: any, idx: number) => ({
            role: row.role,
            idx,
        }));
    await ctx.set_value("roles", roleRows as any);
}

export default function UserScripts() {
    useZui((zui) => {
        zui.form.on("User", {
            async on_render(ctx) {
                await applyRoleProfile(ctx);
            },
            async role_profile(ctx) {
                await applyRoleProfile(ctx);
            },
        });
    }, []);

    return null;
}
