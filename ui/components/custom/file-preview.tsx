import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { cn } from "../../lib/utils";
import { BASE_URL } from "@/zodula/client/utils";
import {
  Download,
  ExternalLink,
  FileCode,
  FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// ── File type detection ────────────────────────────────────────────────────

type FileType = "image" | "pdf" | "csv" | "xlsx" | "text" | "other";

function detectFileType(name: string, mime?: string): FileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"].includes(ext) || mime?.startsWith("image/")) return "image";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (["xlsx", "xls"].includes(ext) || mime?.includes("spreadsheet") || mime?.includes("excel")) return "xlsx";
  if (["txt", "md", "json", "xml", "html", "css", "js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "php", "rb", "go", "rs"].includes(ext) || mime?.startsWith("text/")) return "text";
  return "other";
}

function TypeIcon({ type, className }: { type: FileType; className?: string }) {
  const cls = cn("zd:flex-shrink-0", className);
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "pdf") return <FileText className={cls} />;
  if (type === "csv" || type === "xlsx") return <FileSpreadsheet className={cls} />;
  if (type === "text") return <FileCode className={cls} />;
  return <FileIcon className={cls} />;
}

// ── CSV table renderer ─────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function CsvTable({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return <p className="zd:text-muted-foreground">Empty CSV</p>;
  const headers = parseCsvLine(lines[0]!);
  const rows = lines.slice(1).map(parseCsvLine);
  return (
    <div className="zd:overflow-auto zd:rounded-lg zd:bg-white zd:shadow-lg">
      <table className="zd:min-w-full zd:border-collapse zd:text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="zd:border zd:border-border zd:px-4 zd:py-2 zd:bg-muted zd:font-semibold zd:text-left zd:whitespace-nowrap">
                {h || `Column ${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="zd:even:bg-muted/20">
              {headers.map((_, ci) => (
                <td key={ci} className="zd:border zd:border-border zd:px-4 zd:py-2 zd:whitespace-nowrap">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Floating toolbar ───────────────────────────────────────────────────────

interface ToolbarProps {
  name: string;
  type: FileType;
  fileUrl: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onClose: () => void;
}

function FloatingToolbar({ name, type, fileUrl, zoom, onZoomIn, onZoomOut, onRotate, onClose }: ToolbarProps) {
  const isImg = type === "image";

  return (
    <div
      className={cn(
        "zd:fixed zd:bottom-8 zd:left-1/2 zd:-translate-x-1/2 zd:z-50",
        "zd:flex zd:items-center zd:gap-1 zd:px-3 zd:py-2",
        "zd:rounded-full zd:shadow-2xl",
        "zd:bg-neutral-900/85 zd:backdrop-blur-md zd:border zd:border-white/10",
        "zd:text-white"
      )}
      // Prevent backdrop click from firing when user clicks toolbar
      onClick={(e) => e.stopPropagation()}
    >
      {/* File name */}
      <div className="zd:flex zd:items-center zd:gap-1.5 zd:max-w-[180px] zd:min-w-0">
        <TypeIcon type={type} className="zd:w-3.5 zd:h-3.5 zd:text-white/60 zd:flex-shrink-0" />
        <span className="zd:text-xs zd:text-white/80 zd:truncate" title={name}>
          {name}
        </span>
      </div>

      <Divider />

      {/* Image controls */}
      {isImg && (
        <>
          <ToolbarBtn onClick={onZoomOut} title="Zoom out" disabled={zoom <= 0.25}>
            <ZoomOut className="zd:w-3.5 zd:h-3.5" />
          </ToolbarBtn>
          <span className="zd:text-[11px] zd:text-white/60 zd:min-w-[36px] zd:text-center zd:tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <ToolbarBtn onClick={onZoomIn} title="Zoom in" disabled={zoom >= 3}>
            <ZoomIn className="zd:w-3.5 zd:h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={onRotate} title="Rotate">
            <RotateCw className="zd:w-3.5 zd:h-3.5" />
          </ToolbarBtn>
          <Divider />
        </>
      )}

      {/* Download */}
      <a
        href={fileUrl}
        download={name}
        className={toolbarBtnCls}
        title="Download"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="zd:w-3.5 zd:h-3.5" />
      </a>

      {/* Open in new tab */}
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={toolbarBtnCls}
        title="Open in new tab"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="zd:w-3.5 zd:h-3.5" />
      </a>

      <Divider />

      {/* Close */}
      <ToolbarBtn onClick={onClose} title="Close (Esc)">
        <X className="zd:w-3.5 zd:h-3.5" />
      </ToolbarBtn>
    </div>
  );
}

const toolbarBtnCls = cn(
  "zd:flex zd:items-center zd:justify-center zd:w-7 zd:h-7 zd:rounded-full",
  "zd:text-white/70 zd:hover:text-white zd:hover:bg-white/15 zd:transition-colors"
);

function ToolbarBtn({ onClick, title, disabled, children }: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(toolbarBtnCls, disabled && "zd:opacity-30 zd:cursor-not-allowed")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="zd:w-px zd:h-4 zd:bg-white/15 zd:mx-0.5 zd:flex-shrink-0" />;
}

// ── Main overlay ───────────────────────────────────────────────────────────

interface OverlayProps {
  file: File | string;
  onClose: () => void;
  /** Display name shown in the floating toolbar (overrides the filename). */
  title?: string;
}

function FilePreviewOverlay({ file, onClose, title }: OverlayProps) {
  const isFileObj = file instanceof File;
  const rawName = isFileObj ? file.name : (file.split("/").pop() ?? file);
  const derivedName = decodeURIComponent(rawName);
  const name = title ?? derivedName;
  const mime = isFileObj ? file.type : undefined;
  const type = detectFileType(name, mime);

  const fileUrl = isFileObj
    ? URL.createObjectURL(file)
    : file.startsWith("http") || file.startsWith("data:")
    ? file
    : `${BASE_URL}${file}`;

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (isFileObj) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl, isFileObj]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Image state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 3)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 0.25)), []);
  const handleRotate = useCallback(() => setRotation((r) => (r + 90) % 360), []);

  // Text/CSV state
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  useEffect(() => {
    if (type !== "text" && type !== "csv") return;
    setTextLoading(true);
    fetch(fileUrl)
      .then((r) => r.text())
      .then(setTextContent)
      .catch(() => setTextContent("Error loading file content"))
      .finally(() => setTextLoading(false));
  }, [fileUrl, type]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="zd:fixed zd:inset-0 zd:z-50 zd:bg-black/85 zd:backdrop-blur-sm zd:flex zd:items-center zd:justify-center"
      onClick={handleBackdrop}
    >
      {/* Content */}
      <div
        className="zd:w-full zd:h-full zd:flex zd:items-center zd:justify-center zd:p-8 zd:pb-24 zd:overflow-auto"
        onClick={handleBackdrop}
      >
        {type === "image" ? (
          <img
            src={fileUrl}
            alt={name}
            draggable={false}
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: "transform 0.2s ease" }}
            className="zd:max-w-full zd:max-h-full zd:object-contain zd:rounded-lg zd:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : type === "pdf" ? (
          <iframe
            src={`${fileUrl}#toolbar=1&navpanes=1`}
            title={name}
            className="zd:w-full zd:rounded-lg zd:shadow-2xl zd:bg-white"
            style={{ height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : type === "csv" ? (
          <div className="zd:max-w-full zd:overflow-auto" onClick={(e) => e.stopPropagation()}>
            {textLoading ? (
              <Spinner />
            ) : textContent != null ? (
              <CsvTable text={textContent} />
            ) : null}
          </div>
        ) : type === "text" ? (
          <pre
            className="zd:max-w-4xl zd:w-full zd:max-h-[80vh] zd:overflow-auto zd:p-6 zd:rounded-xl zd:shadow-2xl zd:bg-neutral-900 zd:text-green-400 zd:text-sm zd:font-mono zd:leading-relaxed"
            onClick={(e) => e.stopPropagation()}
          >
            {textLoading ? "Loading…" : (textContent ?? "")}
          </pre>
        ) : (
          /* Unsupported file type */
          <div
            className="zd:flex zd:flex-col zd:items-center zd:gap-4 zd:p-10 zd:rounded-2xl zd:bg-white/5 zd:border zd:border-white/10 zd:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <TypeIcon type={type} className="zd:w-16 zd:h-16 zd:text-white/40" />
            <p className="zd:text-sm zd:text-white/60">Preview not available</p>
            <a
              href={fileUrl}
              download={name}
              className="zd:flex zd:items-center zd:gap-2 zd:px-4 zd:py-2 zd:rounded-lg zd:bg-white/10 zd:hover:bg-white/20 zd:text-sm zd:transition-colors"
            >
              <Download className="zd:w-4 zd:h-4" /> Download
            </a>
          </div>
        )}
      </div>

      {/* Floating toolbar */}
      <FloatingToolbar
        name={name}
        type={type}
        fileUrl={fileUrl}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRotate={handleRotate}
        onClose={onClose}
      />
    </div>
  );
}

function Spinner() {
  return (
    <div className="zd:flex zd:items-center zd:gap-2 zd:text-white/60">
      <div className="zd:w-5 zd:h-5 zd:border-2 zd:border-white/20 zd:border-t-white/70 zd:rounded-full zd:animate-spin" />
      Loading…
    </div>
  );
}

// ── Public API ─────────────────────────────────────────────────────────────

export interface PreviewFileOptions {
  /** Override the filename shown in the floating toolbar. */
  title?: string;
}

/** Open a fullscreen file preview with a floating toolbar. */
export function previewFile(file: File | string, options?: PreviewFileOptions): Promise<void> {
  return new Promise<void>((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(container);
      resolve();
    };

    root.render(<FilePreviewOverlay file={file} onClose={cleanup} title={options?.title} />);
  });
}

// Keep the component export for cases where it's rendered inside an existing tree
export { FilePreviewOverlay };
