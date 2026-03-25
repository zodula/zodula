import React, { useRef, useState } from "react";
import { cn } from "@/zodula/ui/lib/utils";
import { zodula } from "@/zodula/client";
import { useDocList } from "../../hooks/use-doc-list";
import { useTranslation } from "../../hooks/use-translation";
import { previewFile } from "./file-preview";
import {
  Paperclip,
  Upload,
  FileText,
  ImageIcon,
  File,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";

interface AttachmentsProps {
  doctype: Zodula.DoctypeName;
  docId: string;
  className?: string;
}

// ── File type helpers ──────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"]);
const PDF_EXTS = new Set(["pdf"]);

function fileExt(url: string): string {
  return (url.split(".").pop() ?? "").toLowerCase();
}

function isImage(url: string): boolean {
  return IMAGE_EXTS.has(fileExt(url));
}


function fileName(url: string): string {
  return decodeURIComponent(url.split("/").pop() ?? url);
}

function FileTypeIcon({ url, className }: { url: string; className?: string }) {
  const ext = fileExt(url);
  const cls = cn("zd:flex-shrink-0", className);
  if (IMAGE_EXTS.has(ext)) return <ImageIcon className={cls} />;
  if (PDF_EXTS.has(ext)) return <FileText className={cls} />;
  return <File className={cls} />;
}

// ── Single attachment row ──────────────────────────────────────────────────

function AttachmentItem({
  attachment,
  onDelete,
}: {
  attachment: Zodula.SelectDoctype<"Attachment">;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const fileUrl = attachment.file as string;
  const name = fileName(fileUrl);
  const isImg = isImage(fileUrl);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await zodula.doc.delete_doc("Attachment", attachment.id!);
      onDelete();
    } catch {
      setDeleting(false);
    }
  };

  const handlePreview = () => {
    if (fileUrl) previewFile(fileUrl);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handlePreview}
      onKeyDown={(e) => e.key === "Enter" && handlePreview()}
      className={cn(
        "zd:group zd:flex zd:items-center zd:gap-2 zd:rounded-md zd:p-1 zd:cursor-pointer",
        "zd:bg-muted/40 zd:border zd:border-transparent",
        "zd:hover:bg-muted/70 zd:hover:border-border zd:transition-colors",
        deleting && "zd:opacity-50 zd:pointer-events-none"
      )}
    >
      {/* Thumbnail or icon */}
      {isImg ? (
        <img
          src={fileUrl}
          alt={name}
          className="zd:w-12 zd:h-12 zd:rounded zd:object-cover zd:flex-shrink-0 zd:border zd:border-border"
        />
      ) : (
        <div
          className={cn(
            "zd:w-8 zd:h-8 zd:rounded zd:flex zd:items-center zd:justify-center",
            "zd:flex-shrink-0 zd:bg-muted zd:border zd:border-border zd:text-muted-foreground"
          )}
        >
          <FileTypeIcon url={fileUrl} className="zd:w-4 zd:h-4" />
        </div>
      )}

      {/* Name */}
      <span
        className="zd:flex-1 zd:min-w-0 zd:text-xs zd:font-medium zd:text-foreground zd:truncate"
        title={name}
      >
        {name}
      </span>

      {/* Delete — visible on row hover */}
      <button
        onClick={handleDelete}
        className={cn(
          "zd:flex-shrink-0 zd:p-1 zd:rounded zd:transition-colors",
          "zd:text-muted-foreground/50 zd:hover:text-destructive zd:hover:bg-destructive/10",
          "zd:opacity-0 zd:group-hover:opacity-100"
        )}
        title="Delete attachment"
      >
        {deleting ? (
          <div className="zd:w-3.5 zd:h-3.5 zd:border-2 zd:border-destructive/30 zd:border-t-destructive zd:rounded-full zd:animate-spin" />
        ) : (
          <Trash2 className="zd:w-3.5 zd:h-3.5" />
        )}
      </button>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────

export function Attachments({ doctype, docId, className }: AttachmentsProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { docs: attachments, loading, reload } = useDocList({
    doctype: "Attachment",
    filters: [
      ["doctype", "=", doctype],
      ["docId", "=", docId],
    ],
    sort: "created_at",
    order: "desc",
    limit: 50,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("doctype", doctype);
      formData.append("docId", docId);
      formData.append("file", file);
      await zodula.doc.create_doc("Attachment", formData as any);
      reload();
    } catch (err: any) {
      setUploadError(
        err?.response?.data?.error ?? err?.message ?? t("Upload failed")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section className={cn("zd:space-y-2", className)}>
      {/* Section header */}
      <h3 className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wider zd:text-muted-foreground">
        <Paperclip className="zd:w-3.5 zd:h-3.5" />
        {t("Attachments")}
      </h3>

      {/* List */}
      {loading ? (
        <div className="zd:flex zd:items-center zd:gap-2 zd:text-xs zd:text-muted-foreground zd:py-1">
          <div className="zd:w-3 zd:h-3 zd:border-2 zd:border-primary/20 zd:border-t-primary zd:rounded-full zd:animate-spin" />
          {t("Loading")}
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="zd:flex zd:flex-col zd:gap-1">
          {attachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att as Zodula.SelectDoctype<"Attachment">}
              onDelete={reload}
            />
          ))}
        </div>
      ) : (
        <p className="zd:text-xs zd:text-muted-foreground/60 zd:italic zd:py-0.5">
          {t("No attachments")}
        </p>
      )}

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        className="zd:hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        className="zd:w-full zd:gap-2 zd:text-xs zd:h-8"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        loading={uploading}
      >
        <Upload className="zd:w-3 zd:h-3" />
        {uploading ? t("Uploading…") : t("Attach file")}
      </Button>

      {/* Upload error */}
      {uploadError && (
        <div
          className={cn(
            "zd:flex zd:items-start zd:gap-1.5 zd:rounded-md zd:p-2",
            "zd:bg-destructive/10 zd:border zd:border-destructive/30",
            "zd:text-xs zd:text-destructive"
          )}
        >
          <X className="zd:w-3 zd:h-3 zd:flex-shrink-0 zd:mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}
    </section>
  );
}
