import { z } from "bxo";
import { createBackupZipAndRegisterRow } from "@/zodula/server/backup-restore";

export default $action(
  async (ctx) => {
    const allowed = await $zodula.session.hasRoles(["System Admin"]);
    if (!allowed) {
      return ctx.json({ error: "Only System Admin can create backups." }, 403);
    }
    const result = await createBackupZipAndRegisterRow();
    return ctx.json({
      success: true,
      backup_file_id: result.backup_file_id,
      file: result.file,
    });
  },
  {
    body: z.object({}).optional(),
  }
);
