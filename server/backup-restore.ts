import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { zodula } from "@/zodula/server/zodula";
import { genRanHex } from "@/zodula/server/zodula/utils";

export async function createBackupZipAndRegisterRow(): Promise<{
  backup_file_id: string;
  file: string;
}> {
  const cwd = process.cwd();
  const zodulaData = path.join(cwd, ".zodula_data");
  if (!existsSync(zodulaData)) {
    throw new Error("No .zodula_data directory to back up.");
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const zipName = `zodula-backup-${ts}.zip`;
  const tmpZip = path.join(tmpdir(), `zodula-backup-${ts}.zip`);

  try {
    execSync(`cd "${cwd}" && zip -rq "${tmpZip}" .zodula_data -x "*.zip"`, {
      stdio: "inherit",
    });
  } catch (e: unknown) {
    throw new Error(
      e instanceof Error ? e.message : "Failed to create backup zip."
    );
  }

  await zodula.doctype("Backup").get("Backup").bypass(true);

  const id = genRanHex(16);
  const fieldDir = path.join(
    cwd,
    ".zodula_data",
    "files",
    "Backup File",
    id,
    "file"
  );
  await fs.mkdir(fieldDir, { recursive: true });
  const destZip = path.join(fieldDir, zipName);
  await fs.copyFile(tmpZip, destZip);
  await fs.unlink(tmpZip).catch(() => {});

  const fileUrl = ["", "files", "Backup File", id, "file", zipName].join("/");

  const row = (await zodula
    .doctype("Backup File")
    .insert({
      id,
      date_time: $zodula.utils.format(new Date(), "datetime"),
      file: fileUrl,
      parentid: "Backup",
      parentype: "Backup",
      parentfield: "backup_files",
    } as never)
    .override(true)
    .bypass(true)) as { id: string; file: string };

  return { backup_file_id: row.id, file: row.file };
}
