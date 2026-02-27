import { useEffect } from "react";
import { zui } from "@/zodula/ui";
import { zodula } from "@/zodula/client";
import { Cable } from "lucide-react";

export default function EmailScripts() {
    useEffect(() => {
        const doctype = "Email" as const;

        zui.form.on(doctype, "on_render", (frm) => {
            frm.addSecondaryButton(
                "Test Connection",
                async () => {
                    try {
                        const host = frm.getValue("host");
                        const port = frm.getValue("port");
                        const secure = frm.getValue("secure");
                        const user = frm.getValue("user");
                        const password = frm.getValue("password");

                        if (!host || !port) {
                            frm.msgprint?.("Host and port are required.", "error");
                            return;
                        }

                        await zodula.action("zodula.core.email.testConnection", {
                            data: {
                                host: String(host),
                                port: typeof port === "number" ? port : parseInt(String(port), 10),
                                secure: secure === 1,
                                user: user ? String(user) : undefined,
                                password: password ? String(password) : undefined,
                            },
                        });
                        frm.showToast?.("Connection successful.", "success");
                    } catch (err: any) {
                        const message =
                            err?.response?.data?.error ??
                            err?.message ??
                            "Connection failed.";
                        frm.msgprint?.(message, "error");
                    }
                },
                { icon: Cable, variant: "outline" }
            );
        });
    }, []);

    return null;
}
