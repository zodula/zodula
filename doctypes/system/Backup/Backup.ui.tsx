import { zodula } from "@/zodula/client";
import { useZui, useAuth } from "@/zodula/ui";

export default function BackupScripts() {
  const { roles } = useAuth();

  useZui((zui) => {
    zui.form.set_secondary_button(
      "Backup",
      "Back Up",
      async (frm) => {
        try {
          const res = (await zodula.action("zodula.core.backup", {
            data: {},
          })) as { success?: boolean; error?: string };
          if ((res as { error?: string })?.error) {
            zui.toast.error((res as { error: string }).error);
            return;
          }
          await frm.reload?.();
          zui.toast.success("Backup created.");
        } catch (e: unknown) {
          const msg =
            e && typeof e === "object" && "message" in e
              ? String((e as { message?: string }).message)
              : "Backup failed.";
          zui.toast.error(msg);
        }
      },
      {
        icon: "Archive",
        condition: () => (roles || []).includes("System Admin"),
      }
    );
  }, [roles]);

  return null;
}
