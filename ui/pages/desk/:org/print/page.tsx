import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "@/zodula/ui/components/router";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { Loader2, ArrowLeft, RefreshCw, Printer } from "lucide-react";
import ErrorView from "@/zodula/ui/views/error-view";
import { Select } from "@/zodula/ui/components/ui/select";
import { Button } from "@/zodula/ui/components/ui/button";
import { Checkbox } from "@/zodula/ui/components/ui/checkbox";
import { PrintPreviewRenderer } from "@/zodula/ui/components/custom/print-preview-renderer";

const MM_TO_PX = 3.77952755906;
const PDF_SCALE = 3; // medium resolution

export default function PrintPage() {
  const { params, search, back } = useRouter();
  const { t } = useTranslation();
  const org = params.org as string;
  const [refreshKey, setRefreshKey] = useState(0);

  // Only doctype and ids from searchParams; print template and language are local state only
  const doctype = search.doctype as string | undefined;
  const idsParam = search.ids;

  const ids = useMemo(() => {
    try {
      if (typeof idsParam === "string") {
        return JSON.parse(idsParam);
      }
      if (!idsParam) return [];
    } catch (e) {
      return [];
    }
  }, [idsParam]);

  const [localTemplate, setLocalTemplate] = useState<string | null>(null);
  const [localLetterHead, setLocalLetterHead] = useState<string | null>(null);
  const [localLang, setLocalLang] = useState<string | null>(null);
  const [templateDefaultLetterHead, setTemplateDefaultLetterHead] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [template, setTemplate] = useState<any>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Only apply template defaults (letter head, language) when we first load that template,
  // so clearing them is not overwritten by the fetch effect (e.g. Strict Mode or re-runs).
  const lastDefaultsAppliedForTemplateIdRef = useRef<string | null>(null);
  // When true, user has explicitly chosen a template (including "None"); do not auto-select.
  const userHasChosenTemplateRef = useRef<boolean>(false);

  const effectiveTemplateId = localTemplate || null;

  const { docs: printTemplates, loading: templatesLoading } = useDocList(
    {
      doctype: "Print Template",
      limit: 1000,
      filters: doctype ? [["doctype", "=", doctype]] : [],
      sort: "is_default",
      order: "desc",
    },
    [doctype]
  );

  // Reset template/language/letter head when doctype changes so we re-auto-select for the new doctype
  useEffect(() => {
    lastDefaultsAppliedForTemplateIdRef.current = null;
    userHasChosenTemplateRef.current = false;
    setLocalTemplate(null);
    setLocalLetterHead(null);
    setLocalLang(null);
    setTemplateDefaultLetterHead(null);
    setTemplate(null);
  }, [doctype]);

  // Auto-select only when there is a template marked as default (is_default); otherwise leave as None
  useEffect(() => {
    if (!doctype || !printTemplates?.length || userHasChosenTemplateRef.current || localTemplate != null) return;
    const defaultTemplate = printTemplates.find((t: any) => t.is_default === 1 || t.is_default === true);
    if (defaultTemplate?.id) setLocalTemplate(defaultTemplate.id);
  }, [doctype, printTemplates, localTemplate]);

  useEffect(() => {
    async function fetchTemplate() {
      if (!effectiveTemplateId) {
        lastDefaultsAppliedForTemplateIdRef.current = null;
        setTemplate(null);
        setTemplateDefaultLetterHead(null);
        setLocalLetterHead(null);
        setLocalLang(null);
        setTemplateLoading(false);
        setTemplateError(null);
        return;
      }
      setTemplateLoading(true);
      setTemplateError(null);
      try {
        const { zodula } = await import("@/zodula/client");
        const result = await zodula?.doc?.get_doc("Print Template", effectiveTemplateId);
        setTemplate(result || null);
        const defaultLh = result?.default_letter_head ?? null;
        const defaultLang = result?.default_lang ?? null;
        setTemplateDefaultLetterHead(defaultLh);
        // Only apply template defaults when we first load this template id, so user can clear
        // without the effect overwriting (e.g. React Strict Mode double-run or re-fetch).
        if (lastDefaultsAppliedForTemplateIdRef.current !== effectiveTemplateId) {
          lastDefaultsAppliedForTemplateIdRef.current = effectiveTemplateId;
          setLocalLetterHead(defaultLh);
          setLocalLang(defaultLang);
        }
        setTemplateError(null);
      } catch (e: any) {
        setTemplateError(e?.message || "Failed to load print template");
        setTemplate(null);
        setTemplateDefaultLetterHead(null);
        setLocalLetterHead(null);
        setLocalLang(null);
      } finally {
        setTemplateLoading(false);
      }
    }
    fetchTemplate();
    // Intentionally omit refreshKey: Refresh only refetches documents and re-mounts preview,
    // so option values (template, language, letter head) are not reset.
  }, [effectiveTemplateId]);

  const pdfPageOptions = useMemo(() => {
    if (template) {
      const format =
        template.format === "Custom"
          ? ([Number(template.custom_width) || 210, Number(template.custom_height) || 297] as [number, number])
          : (template.format || "A4");
      return {
        format,
        orientation: "portrait" as const,
        margin: 0,
      };
    }
    return {
      format: "A4" as const,
      orientation: "portrait" as const,
      margin: 0,
    };
  }, [template]);

  const targetRef = useRef<HTMLDivElement>(null);

  // 1x1 transparent PNG – replace img src in clone so canvas is not tainted
  const TRANSPARENT_PIXEL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const handlePrint = useCallback(async () => {
    const target = targetRef.current;
    if (!target) return;
    setIsGeneratingPdf(true);
    const el = document.documentElement;
    const body = document.body;
    const savedRootBg = el.style.getPropertyValue("background-color");
    const savedBodyBg = body.style.getPropertyValue("background-color");
    el.style.setProperty("background-color", "#ffffff", "important");
    body.style.setProperty("background-color", "#ffffff", "important");
    target.classList.add("pdf-export-isolate");
    const cleanup = () => {
      el.style.removeProperty("background-color");
      body.style.removeProperty("background-color");
      if (savedRootBg) el.style.setProperty("background-color", savedRootBg);
      if (savedBodyBg) body.style.setProperty("background-color", savedBodyBg);
      target.classList.remove("pdf-export-isolate");
      setIsGeneratingPdf(false);
    };
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(target, {
        scale: PDF_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        allowTaint: false,
        onclone: (_doc: Document, clone: HTMLElement) => {
          clone.querySelectorAll(".guided-background-preview").forEach((node) => {
            (node as HTMLElement).style.backgroundImage = "none";
          });
          clone.querySelectorAll("img").forEach((img) => {
            (img as HTMLImageElement).src = TRANSPARENT_PIXEL;
          });
          clone.querySelectorAll("[style*='background-image']").forEach((node) => {
            (node as HTMLElement).style.backgroundImage = "none";
          });
          // Force transparent background on all table cells so PDF matches preview (no grey header/rows)
          clone.querySelectorAll("table, table thead, table tbody, table tr, table th, table td").forEach((el) => {
            (el as HTMLElement).style.setProperty("background-color", "transparent", "important");
          });
        },
      });
      const format = pdfPageOptions.format;
      const orientation = pdfPageOptions.orientation || "portrait";
      const margin = typeof pdfPageOptions.margin === "number" ? pdfPageOptions.margin : 0;
      const pdf = new jsPDF({
        format: Array.isArray(format) ? format : (format as string),
        orientation,
        unit: "mm",
      });
      const pageW = (pdf as any).internal?.pageSize?.getWidth?.() ?? (pdf as any).getPageWidth?.() ?? 210;
      const pageH = (pdf as any).internal?.pageSize?.getHeight?.() ?? (pdf as any).getPageHeight?.() ?? 297;
      const marginLeft = margin;
      const marginTop = margin;
      const availableW = pageW - marginLeft * 2;
      const availableH = pageH - marginTop * 2;
      const origW = canvas.width / PDF_SCALE;
      const origH = canvas.height / PDF_SCALE;
      const fitW = availableW * MM_TO_PX * PDF_SCALE;
      const fitH = availableH * MM_TO_PX * PDF_SCALE;
      const horizontalFit = origW > fitW / PDF_SCALE ? (fitW / PDF_SCALE) / origW : 1;
      const pageAvailableH = availableH * MM_TO_PX * PDF_SCALE * horizontalFit;
      const numPages = Math.ceil((canvas.height / PDF_SCALE) / (pageAvailableH / PDF_SCALE)) || 1;
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (pageNum > 1) pdf.addPage(Array.isArray(format) ? (format as [number, number]) : (format as string), orientation);
        const offsetY = (pageNum - 1) * (pageAvailableH / PDF_SCALE);
        const sliceH = Math.min(canvas.height / PDF_SCALE - offsetY, pageAvailableH / PDF_SCALE);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.ceil(sliceH * PDF_SCALE);
        const ctx = pageCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0, offsetY * PDF_SCALE, canvas.width, sliceH * PDF_SCALE,
          0, 0, canvas.width, sliceH * PDF_SCALE
        );
        const imgData = pageCanvas.toDataURL("image/jpeg", 1.0);
        const wMm = pageCanvas.width / (PDF_SCALE * MM_TO_PX * horizontalFit);
        const hMm = pageCanvas.height / (PDF_SCALE * MM_TO_PX * horizontalFit);
        pdf.addImage({
          imageData: imgData,
          format: "JPEG",
          x: marginLeft,
          y: marginTop,
          width: wMm,
          height: hMm,
        });
      }
      window.open(pdf.output("bloburl"), "_blank");
    } catch (err) {
      console.error("[Print] PDF generation failed:", err);
    } finally {
      cleanup();
    }
  }, [pdfPageOptions]);

  const { docs: languages } = useDocList({
    doctype: "Language",
    limit: 500,
    sort: "name",
    order: "asc",
  });

  const { docs: letterHeads, loading: letterHeadsLoading } = useDocList({
    doctype: "Letter Head",
    limit: 1000,
    filters: [["disabled", "!=", 1]],
    sort: "is_default",
    order: "desc",
  });

  const { docs: fetchedDocs, loading: docsLoading, error: docsError } = useDocList({
    doctype: doctype as Zodula.DoctypeName,
    limit: ids.length || 100,
    filters: ids.length > 0 ? [["id", "IN", ids]] : [],
  }, [doctype, ids, refreshKey]);

  const printTemplateOptions = useMemo(
    () => [
      { value: "", label: t("None") },
      ...printTemplates.map((d: any) => ({
        value: d.id,
        label: d.name ?? d.id,
      })),
    ],
    [printTemplates, t]
  );

  const languageOptions = useMemo(
    () => [
      { value: "", label: t("None") },
      ...languages.map((d: any) => ({
        value: d.id,
        label: d.name ?? d.code ?? d.id,
      })),
    ],
    [languages, t]
  );

  const letterHeadOptions = useMemo(
    () => [
      { value: "", label: t("None") },
      ...letterHeads.map((d: any) => ({
        value: d.id,
        label: d.name ?? d.id,
      })),
    ],
    [letterHeads, t]
  );

  useEffect(() => {
    if (!doctype || ids.length === 0) {
      setError("Missing required parameters: doctype and ids");
      return;
    }
    if (!docsLoading && fetchedDocs.length === 0 && ids.length > 0) {
      setError(`No documents found for the provided IDs: ${ids.join(", ")}`);
      return;
    }
    setError(null);
  }, [doctype, ids, docsLoading, fetchedDocs.length]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!doctype || ids.length === 0) {
    return (
      <div className="zd:p-8">
        <ErrorView
          message={t("Missing required parameters. Please provide doctype and ids in the URL.")}
          status={400}
        />
      </div>
    );
  }

  const isLoadingState = templateLoading || letterHeadsLoading || docsLoading || templatesLoading;
  const isFixedPosition = template ? ((template as any).is_fixed_position === 1 || (template as any).is_fixed_position === true) : true;

  if (templateError) {
    return (
      <div className="zd:p-8">
        <ErrorView
          message={`${t("Error loading print template")}: ${templateError}`}
          status={500}
        />
      </div>
    );
  }

  return (
    <div className="zd:flex zd:h-screen zd:overflow-hidden zd:bg-background">
      <div className="zd:w-80 zd:border-r zd:border-border zd:flex zd:flex-col zd:bg-muted/30">
        <div className="zd:flex zd:items-center zd:gap-2 zd:p-4 zd:border-b zd:border-border">
          <Button variant="ghost" size="sm" onClick={() => back()} className="zd:p-2">
            <ArrowLeft className="zd:w-4 zd:h-4" />
          </Button>
          <h2 className="zd:text-lg zd:font-semibold">{t("Print Settings")}</h2>
        </div>
        <div className="zd:px-4 zd:py-3 zd:border-b zd:border-border">
          <div className="zd:text-sm zd:font-medium zd:text-muted-foreground">
            {ids.length > 1 ? `${ids.length} ${t("documents")}` : ids[0] || ""}
          </div>
        </div>
        <div className="zd:flex-1 zd:overflow-y-auto zd:p-4 zd:space-y-4">
          <div className="zd:space-y-1">
            <label className="zd:text-sm zd:font-medium">{t("Print Template")}</label>
            <Select
              displayMode="label"
              value={localTemplate ?? ""}
              onChange={(v) => {
                userHasChosenTemplateRef.current = true;
                setLocalTemplate(v || null);
              }}
              options={printTemplateOptions}
              placeholder={t("Select template")}
              searchable
              clearable
              className="zd:w-full"
            />
            {!localTemplate && (
              <div className="zd:text-xs zd:text-muted-foreground zd:mt-1">
                {t("Using default template generated from doctype tabs")}
              </div>
            )}
          </div>
          <div className="zd:space-y-1">
            <label className="zd:text-sm zd:font-medium">{t("Language")}</label>
            <Select
              displayMode="label"
              value={localLang ?? ""}
              onChange={(v) => setLocalLang(v || null)}
              options={languageOptions}
              placeholder={t("Select language")}
              searchable
              clearable
              className="zd:w-full"
            />
          </div>
          <div className="zd:space-y-1">
            <label className="zd:text-sm zd:font-medium">{t("Letter Head")}</label>
            <Select
              displayMode="label"
              value={localLetterHead ?? ""}
              onChange={(v) => setLocalLetterHead(v || null)}
              options={letterHeadOptions}
              placeholder={t("Select letter head")}
              searchable
              clearable
              className="zd:w-full"
            />
          </div>
          <div className="zd:flex zd:items-center zd:space-x-2">
            <Checkbox checked={isFixedPosition} disabled={true} />
            <label className="zd:text-sm zd:font-medium zd:text-muted-foreground">
              {t("Fixed Position Layout")}
            </label>
          </div>
        </div>
      </div>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:overflow-hidden">
        <div className="zd:flex zd:items-center zd:gap-2 zd:p-3 zd:border-b zd:border-border zd:bg-background">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingState}>
            <RefreshCw className="zd:w-4 zd:h-4 zd:mr-2" />
            {t("Refresh")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={
              isLoadingState ||
              isGeneratingPdf ||
              !doctype ||
              ids.length === 0 ||
              !!error ||
              !!docsError ||
              fetchedDocs.length === 0
            }
          >
            {isGeneratingPdf ? (
              <Loader2 className="zd:w-4 zd:h-4 zd:mr-2 zd:animate-spin" />
            ) : (
              <Printer className="zd:w-4 zd:h-4 zd:mr-2" />
            )}
            {t("Print")}
          </Button>
        </div>
        <div className="zd:flex-1 zd:overflow-auto zd:bg-muted/20 zd:p-4">
          <style>{`
            .pdf-export-isolate,
            .pdf-export-isolate *,
            .pdf-export-isolate *::before,
            .pdf-export-isolate *::after {
              color: #1f2937 !important;
              background-color: #ffffff !important;
              border-color: #e5e7eb !important;
              outline-color: #1f2937 !important;
              text-decoration-color: #1f2937 !important;
              box-shadow: none !important;
              fill: #1f2937 !important;
              stroke: #e5e7eb !important;
              column-rule-color: #e5e7eb !important;
              caret-color: #1f2937 !important;
            }
            .pdf-export-isolate {
              background-color: #ffffff !important;
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              font-size: 14px !important;
              line-height: 1.5 !important;
            }
            .pdf-export-isolate table {
              border-collapse: collapse !important;
              width: 100% !important;
              table-layout: fixed !important;
              box-sizing: border-box !important;
              background-color: transparent !important;
            }
            .pdf-export-isolate table th,
            .pdf-export-isolate table td {
              border: 1px solid #e5e7eb !important;
              padding: 0 4px !important;
              text-align: left !important;
              vertical-align: top !important;
              line-height: 1 !important;
              background-color: transparent !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            .pdf-export-isolate table thead th {
              font-weight: 600 !important;
              color: #1f2937 !important;
              border-bottom: 2px solid #e5e7eb !important;
            }
            /* No background, match preview – no striped rows or header fill */
            .pdf-export-isolate table.print-preview-table-no-border,
            .pdf-export-isolate table.print-preview-table-no-border th,
            .pdf-export-isolate table.print-preview-table-no-border td {
              border: none !important;
            }
            .pdf-export-isolate table.print-preview-table-no-border thead th {
              border-bottom: none !important;
            }
            .pdf-export-isolate .page-break,
            .pdf-export-isolate .page-break-before,
            .pdf-export-isolate .page-break-after {
              display: block !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              border: none !important;
              visibility: hidden !important;
            }
            .pdf-export-isolate .page-break--visible {
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              overflow: hidden !important;
              visibility: hidden !important;
            }
            .pdf-export-isolate .print-preview-container {
              background-color: #ffffff !important;
            }
            /* Hide guided background in PDF (show only in preview) */
            .pdf-export-isolate .guided-background-preview {
              display: none !important;
              visibility: hidden !important;
              height: 0 !important;
              overflow: hidden !important;
              background-image: none !important;
            }
            .pdf-export-isolate .page-container {
              margin-bottom: 0 !important;
              box-shadow: none !important;
              height: calc(var(--page-height-mm, 297) * 1mm) !important;
              min-height: calc(var(--page-height-mm, 297) * 1mm) !important;
              overflow: hidden !important;
            }
          `}</style>
          {isLoadingState ? (
            <div className="zd:flex zd:items-center zd:justify-center zd:h-full">
              <div className="zd:flex zd:flex-col zd:items-center zd:gap-4">
                <Loader2 className="zd:w-8 zd:h-8 zd:animate-spin zd:text-muted-foreground" />
                <div className="zd:text-muted-foreground">{t("Loading print preview...")}</div>
              </div>
            </div>
          ) : error || docsError ? (
            <div className="zd:p-8">
              <ErrorView message={error || docsError || t("Failed to load documents")} status={400} />
            </div>
          ) : doctype && ids.length > 0 && fetchedDocs.length > 0 ? (
            <div className="zd:p-2">
              <PrintPreviewRenderer
                targetRef={targetRef as React.RefObject<HTMLDivElement>}
                key={refreshKey}
                doctype={doctype}
                docIds={ids}
                printTemplateId={effectiveTemplateId ?? undefined}
                letterHeadId={localLetterHead ?? undefined}
                language={localLang ?? undefined}
                org={org}
              />
            </div>
          ) : (
            <div className="zd:flex zd:items-center zd:justify-center zd:h-full">
              <div className="zd:text-center">
                <div className="zd:text-muted-foreground zd:mb-2">{t("No preview available")}</div>
                <div className="zd:text-sm zd:text-muted-foreground">
                  {t("Please select a print template to generate preview")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
