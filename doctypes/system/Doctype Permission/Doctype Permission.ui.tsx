import { useZui } from "@/zodula/ui";

function setDoctypeFiltersByApp(frm: any) {
    const app = frm.doc.app;
    const filters = app ? JSON.stringify([["app", "=", app]]) : null;
    frm.set_df_property("doctype", "filters", filters);
}

export default function DoctypePermissionScripts() {
    useZui((zui) => {
        zui.form.on("Doctype Permission", {
            on_render(ctx) {
                setDoctypeFiltersByApp(ctx);
            },
            app(frm: any) {
                setDoctypeFiltersByApp(frm);
            },
        });
    }, []);

    return null;
}
