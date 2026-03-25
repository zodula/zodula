import { loader } from "@/zodula/server/loader";
import { ZodulaDoctypeHelper } from "@/zodula/server/zodula/doc/helper";
import { ErrorWithCode } from "@/zodula/error";
import path from "path";
import fs from "fs/promises";

async function assertCanUpdateParent(attachmentDoc: any) {
  const refDoctype = attachmentDoc?.doctype as Zodula.DoctypeName | undefined;
  const refDocId = attachmentDoc?.docId as string | undefined;
  if (!refDoctype || !refDocId) return;

  const refDoc = await $zodula.doctype(refDoctype).get(refDocId).bypass(true);
  if (!refDoc?.id) return;

  const refDoctypeSchema = loader.from("doctype").get(refDoctype);
  const { can } = await ZodulaDoctypeHelper.checkPermission(
    refDoctype,
    "can_update",
    refDoc,
    {
      bypass: false,
      doctype: refDoctypeSchema,
    }
  );

  if (!can) {
    throw new ErrorWithCode("You do not have permission to attach files to this document", {
      status: 403,
    });
  }
}

async function cleanupAttachmentFiles(attachmentId: string) {
  const candidateDirs = [
    path.join(process.cwd(), ".zodula_data", "files", "doctypes", "Attachment", attachmentId),
    path.join(process.cwd(), ".zodula_data", "files", "Attachment", attachmentId),
  ];

  for (const filesDir of candidateDirs) {
    try {
      await fs.access(filesDir);
    } catch {
      continue;
    }

    const fieldDirs = await fs.readdir(filesDir);
    for (const fieldDir of fieldDirs) {
      const fieldPath = path.join(filesDir, fieldDir);
      const stat = await fs.stat(fieldPath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(fieldPath);
      for (const file of files) {
        await fs.unlink(path.join(fieldPath, file));
      }
      await fs.rmdir(fieldPath);
    }

    await fs.rmdir(filesDir).catch(() => {});
  }
}

export default $doctype<"Attachment">(
  {
    doctype: {
      type: "Reference",
      reference: "Doctype",
      label: "Doctype",
      required: 1,
    },
    docId: {
      type: "Virtual Reference",
      reference: "{{doctype}}",
      label: "Document",
      required: 1,
    },
    file: {
      type: "File",
      label: "File",
      required: 1,
    },
  },
  {
    label: "Attachment",
    track_changes: 0,
  }
)
  .on("after_insert", async ({ doc }) => {
    try {
      await assertCanUpdateParent(doc);
    } catch (e) {
      // Clean up inserted attachment filesystem when permission fails.
      // DB rollback is handled by the surrounding transaction.
      if (doc?.id) {
        await cleanupAttachmentFiles(doc.id);
      }
      throw e;
    }
  })
  .on("before_delete", async ({ doc }) => {
    // Enforce delete permission delegated to the parent doc.
    await assertCanUpdateParent(doc);
  })
  .on("after_delete", async () => {
    // Reserved for future after_delete handling.
  });
