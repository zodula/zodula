import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import MyEditor from "@/zodula/ui/components/custom/editor";
import { useResize } from "@/zodula/ui/hooks/use-resize";
import { Button } from "@/zodula/ui/components/ui/button";
import { cn } from "@/zodula/ui/lib/utils";

const mmToPx = (mm: number) => mm * 96 / 25.4;
const pxToMm = (px: number) => px * 25.4 / 96;

export type ZodulaHtmlBuilderProps = {
  /** Initial HTML (rendered as-is in preview) */
  html?: string;
  css?: string;
  js?: string;
  onChange?: (ctx: { html: string; css: string; js: string }) => void;
  /** @deprecated Unused; preview renders HTML as-is. Kept for API compatibility. */
  previewContext?: { doc?: Record<string, unknown>; zodula?: unknown };
  /** Enable HTML / CSS / JS panels */
  enabledPanels?: { html?: boolean; css?: boolean; js?: boolean };
  /** Default editor panel width (px) */
  defaultEditorWidth?: number;
  /** Preset screen sizes for preview (e.g. A4, mobile) */
  screenSizes?: { name: string; width: number; height: number }[];
  /** Default preview width (px) */
  defaultPreviewWidth?: number;
  /** Default preview height (px) */
  defaultPreviewHeight?: number;
  /** Allow custom size inputs */
  allowCustomSize?: boolean;
  /** Default zoom (0.25 to 2) */
  defaultZoom?: number;
  /** Page margins in mm (e.g. from Print Template settings). Applied as body padding in preview. */
  margins?: { top?: number; right?: number; bottom?: number; left?: number };
  /** When true, hide the editor panel and resizer; show only the preview (e.g. for print page). */
  previewOnly?: boolean;
  /** Unit for default preview size and for onPreviewSizeChange. When "mm", defaultPreviewWidth/Height are in mm and callback receives mm. */
  sizeUnit?: "px" | "mm";
  /** Called when preview canvas size changes (e.g. for print to use same size as preview). Values in sizeUnit (px or mm). */
  onPreviewSizeChange?: (width: number, height: number) => void;
  className?: string;
};

const DEFAULT_HTML = "<div>Content</div>";
const DEFAULT_CSS = "body { margin: 0; padding: 1rem; font-family: sans-serif; }";
const DEFAULT_JS = "// Optional script";

/** Round zoom to nearest 10% (0.25, 0.3, 0.4, ... 2) */
function zoomToNearest10(z: number): number {
  const pct = Math.round((z * 100) / 10) * 10;
  return Math.max(25, Math.min(200, pct)) / 100;
}

export function ZodulaHtmlBuilder({
  html = DEFAULT_HTML,
  css = DEFAULT_CSS,
  js = DEFAULT_JS,
  onChange,
  enabledPanels = { html: true, css: true, js: false },
  defaultEditorWidth = 380,
  screenSizes = [
    { name: "A4", width: 794, height: 1123 },
    { name: "A5", width: 559, height: 794 },
    { name: "Mobile", width: 390, height: 844 },
  ],
  defaultPreviewWidth = 794,
  defaultPreviewHeight = 1123,
  allowCustomSize = true,
  defaultZoom = 0.75,
  margins,
  previewOnly = false,
  sizeUnit = "px",
  onPreviewSizeChange,
  className,
}: ZodulaHtmlBuilderProps) {
  const [htmlVal, setHtmlVal] = useState(html);
  const [cssVal, setCssVal] = useState(css);
  const [jsVal, setJsVal] = useState(js);
  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const defaultW = sizeUnit === "mm" ? mmToPx(defaultPreviewWidth) : defaultPreviewWidth;
  const defaultH = sizeUnit === "mm" ? mmToPx(defaultPreviewHeight) : defaultPreviewHeight;
  const [previewWidth, setPreviewWidth] = useState(defaultW);
  const [previewHeight, setPreviewHeight] = useState(defaultH);
  const [zoom, setZoom] = useState(() => zoomToNearest10(defaultZoom));
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { width: editorWidth, startResize } = useResize({
    initialWidth: defaultEditorWidth,
    minWidth: 200,
    maxWidth: 800,
  });

  // Keep internal state in sync with props (e.g. when parent re-syncs from server after toggling is_html)
  useEffect(() => {
    setHtmlVal((v) => (v === html ? v : html));
    setCssVal((v) => (v === css ? v : css));
    setJsVal((v) => (v === js ? v : js));
  }, [html, css, js]);

  const notifyChange = useCallback(
    (next: { html?: string; css?: string; js?: string }) => {
      onChange?.({
        html: next.html ?? htmlVal,
        css: next.css ?? cssVal,
        js: next.js ?? jsVal,
      });
    },
    [onChange, htmlVal, cssVal, jsVal]
  );

  const handleHtmlChange = useCallback(
    (v: string) => {
      setHtmlVal(v);
      notifyChange({ html: v });
    },
    [notifyChange]
  );
  const handleCssChange = useCallback(
    (v: string) => {
      setCssVal(v);
      notifyChange({ css: v });
    },
    [notifyChange]
  );
  const handleJsChange = useCallback(
    (v: string) => {
      setJsVal(v);
      notifyChange({ js: v });
    },
    [notifyChange]
  );

  const t = margins?.top ?? 0;
  const r = margins?.right ?? 0;
  const b = margins?.bottom ?? 0;
  const l = margins?.left ?? 0;
  const paddingDecl = (t || r || b || l) ? `padding:${t}mm ${r}mm ${b}mm ${l}mm;` : "";
  // Isolated print-preview document: reset so only template CSS applies (no host-page influence).
  const previewBaseCss = `body{all:revert;margin:0;padding:0;color:#111;background:#fff;font-family:sans-serif;${paddingDecl}}`;

  useEffect(() => {
    if (sizeUnit === "mm") {
      onPreviewSizeChange?.(pxToMm(previewWidth), pxToMm(previewHeight));
    } else {
      onPreviewSizeChange?.(previewWidth, previewHeight);
    }
  }, [previewWidth, previewHeight, sizeUnit]);

  const fullDoc = useMemo(
    () =>
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${previewBaseCss}</style><style>${cssVal}</style></head><body>${htmlVal || ""}</body>${jsVal?.trim() ? `<script>${jsVal}</script>` : ""}</html>`,
    [previewBaseCss, htmlVal, cssVal, jsVal]
  );

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = fullDoc;
  }, [fullDoc]);

  const showEditorPanel = !previewOnly && (enabledPanels.html || enabledPanels.css || enabledPanels.js);

  return (
    <div className={cn("zd:flex zd:flex-col zd:h-full zd:min-h-[480px] zd:rounded-lg zd:border zd:border-border zd:overflow-hidden zd:bg-background", className)}>
      <div className="zd:flex zd:flex-1 zd:min-h-0">
        {showEditorPanel && (
          <>
            {/* Left: editors */}
            <div
              className="zd:flex zd:flex-col zd:border-r zd:border-border zd:bg-muted/30 zd:min-w-0"
              style={{ width: editorWidth }}
            >
              {/* Tabs */}
              <div className="zd:flex zd:border-b zd:border-border zd:bg-muted/50 zd:shrink-0">
                {enabledPanels.html && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("html")}
                    className={cn(
                      "zd:px-4 zd:py-2.5 zd:text-sm zd:font-medium zd:border-b-2 zd:transition-colors zd:rounded-t-md",
                      activeTab === "html"
                        ? "zd:border-primary zd:text-primary zd:bg-background zd:shadow-[0_1px_0_0_var(--border)]"
                        : "zd:border-transparent zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/50"
                    )}
                  >
                    HTML
                  </button>
                )}
                {enabledPanels.css && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("css")}
                    className={cn(
                      "zd:px-4 zd:py-2.5 zd:text-sm zd:font-medium zd:border-b-2 zd:transition-colors zd:rounded-t-md",
                      activeTab === "css"
                        ? "zd:border-primary zd:text-primary zd:bg-background zd:shadow-[0_1px_0_0_var(--border)]"
                        : "zd:border-transparent zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/50"
                    )}
                  >
                    CSS
                  </button>
                )}
                {enabledPanels.js && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("js")}
                    className={cn(
                      "zd:px-4 zd:py-2.5 zd:text-sm zd:font-medium zd:border-b-2 zd:transition-colors zd:rounded-t-md",
                      activeTab === "js"
                        ? "zd:border-primary zd:text-primary zd:bg-background zd:shadow-[0_1px_0_0_var(--border)]"
                        : "zd:border-transparent zd:text-muted-foreground zd:hover:text-foreground zd:hover:bg-muted/50"
                    )}
                  >
                    JS
                  </button>
                )}
              </div>
              <div className="zd:flex-1 zd:min-h-0 zd:overflow-hidden">
                {enabledPanels.html && activeTab === "html" && (
                  <MyEditor
                    value={htmlVal}
                    onChange={handleHtmlChange}
                    language="html"
                    height="100%"
                    className="zd:rounded-none zd:border-0 zd:h-full"
                  />
                )}
                {enabledPanels.css && activeTab === "css" && (
                  <MyEditor
                    value={cssVal}
                    onChange={handleCssChange}
                    language="css"
                    height="100%"
                    className="zd:rounded-none zd:border-0 zd:h-full"
                  />
                )}
                {enabledPanels.js && activeTab === "js" && (
                  <MyEditor
                    value={jsVal}
                    onChange={handleJsChange}
                    language="javascript"
                    height="100%"
                    className="zd:rounded-none zd:border-0 zd:h-full"
                  />
                )}
              </div>
            </div>
            {/* Resizable divider: wider hit area, platform colors */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={editorWidth}
              className="zd:flex-shrink-0 zd:flex zd:items-stretch zd:justify-center zd:cursor-col-resize zd:group zd:hover:bg-accent/50 zd:transition-colors"
              style={{ width: 10 }}
              onMouseDown={(e) => startResize(e, editorWidth)}
            >
              <div className="zd:w-px zd:bg-border group-hover:zd:bg-primary/40 zd:transition-colors" />
            </div>
          </>
        )}
        {/* Right: preview — platform colors only */}
        <div className="zd:flex-1 zd:flex zd:flex-col zd:min-w-0 zd:bg-muted/40">
          {/* Preview toolbar */}
          <div className="zd:flex zd:items-center zd:gap-3 zd:px-3 zd:py-2 zd:border-b zd:border-border zd:bg-background/80 zd:shrink-0">
            <span className="zd:text-xs zd:font-medium zd:text-muted-foreground zd:uppercase zd:tracking-wider">
              Size{sizeUnit === "mm" ? " (mm)" : " (px)"}
            </span>
            <select
              className="zd:rounded-md zd:border zd:border-input zd:bg-background zd:px-2.5 zd:py-1.5 zd:text-sm zd:text-foreground focus:zd:outline-none focus:zd:ring-2 focus:zd:ring-ring"
              value={screenSizes.find((s) => s.width === previewWidth && s.height === previewHeight)?.name ?? ""}
              onChange={(e) => {
                const s = screenSizes.find((x) => x.name === e.target.value);
                if (s) {
                  setPreviewWidth(s.width);
                  setPreviewHeight(s.height);
                }
              }}
            >
              {screenSizes.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} (
                  {sizeUnit === "mm"
                    ? `${Math.round(pxToMm(s.width))}×${Math.round(pxToMm(s.height))}`
                    : `${s.width}×${s.height}`}
                  )
                </option>
              ))}
              {allowCustomSize && <option value="">Custom</option>}
            </select>
            {allowCustomSize && (
              <>
                <input
                  type="number"
                  className="zd:w-20 zd:rounded-md zd:border zd:border-input zd:bg-background zd:px-2 zd:py-1.5 zd:text-sm zd:text-foreground"
                  placeholder={sizeUnit === "mm" ? "210" : "W"}
                  value={sizeUnit === "mm" ? Math.round(pxToMm(previewWidth)) : previewWidth}
                  onChange={(e) =>
                    setPreviewWidth(sizeUnit === "mm" ? mmToPx(Number(e.target.value) || 210) : Number(e.target.value) || 400)
                  }
                />
                <span className="zd:text-muted-foreground zd:select-none">×</span>
                <input
                  type="number"
                  className="zd:w-20 zd:rounded-md zd:border zd:border-input zd:bg-background zd:px-2 zd:py-1.5 zd:text-sm zd:text-foreground"
                  placeholder={sizeUnit === "mm" ? "297" : "H"}
                  value={sizeUnit === "mm" ? Math.round(pxToMm(previewHeight)) : previewHeight}
                  onChange={(e) =>
                    setPreviewHeight(sizeUnit === "mm" ? mmToPx(Number(e.target.value) || 297) : Number(e.target.value) || 600)
                  }
                />
              </>
            )}
            <span className="zd:text-xs zd:font-medium zd:text-muted-foreground zd:uppercase zd:tracking-wider zd:ml-2">Zoom</span>
            <div className="zd:flex zd:items-center zd:gap-1 zd:bg-muted/50 zd:rounded-md zd:p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="zd:h-7 zd:w-7 zd:p-0 zd:rounded"
                onClick={() => setZoom((z) => zoomToNearest10(Math.max(0.25, z - 0.1)))}
              >
                −
              </Button>
              <span className="zd:min-w-[2.5rem] zd:text-center zd:text-sm zd:font-medium zd:text-foreground">{Math.round((zoom * 100) / 10) * 10}%</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="zd:h-7 zd:w-7 zd:p-0 zd:rounded"
                onClick={() => setZoom((z) => zoomToNearest10(Math.min(2, z + 0.1)))}
              >
                +
              </Button>
            </div>
          </div>
          <div className="zd:flex-1 zd:overflow-auto zd:p-6 zd:flex zd:items-start zd:justify-center zd:bg-muted/30">
            {/* Isolated print-preview canvas: inline-only layout so site CSS cannot affect it */}
            <div
              style={{
                width: previewWidth,
                height: previewHeight,
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                flexShrink: 0,
                boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
                borderRadius: "2px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#fff",
                overflow: "hidden",
              }}
            >
              <iframe
                ref={iframeRef}
                title="Preview"
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: "#fff",
                  borderRadius: "2px",
                }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ZodulaHtmlBuilder;
