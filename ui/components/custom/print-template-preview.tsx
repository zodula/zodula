import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { zodula } from "@/zodula/client";
import { useDocList } from "../../hooks/use-doc-list";
import { useDoc } from "../../hooks/use-doc";
import { useTranslation } from "../../hooks/use-translation";
import { X, Eye, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { popup } from "../ui/popit";

interface PrintTemplatePreviewProps {
  templateId?: string;
  doctype?: string;
  layout?: any;
  html?: string;
  isCustom?: boolean;
  format?: string;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  letterHeadId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PrintTemplatePreview({
  templateId,
  doctype,
  layout,
  html,
  isCustom = false,
  format = "A4",
  marginTop = 10,
  marginRight = 10,
  marginBottom = 10,
  marginLeft = 10,
  letterHeadId,
  open = false,
  onOpenChange,
}: PrintTemplatePreviewProps) {
  const { t, currentLanguage, availableLanguages } = useTranslation();
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [selectedLang, setSelectedLang] = useState<string>(currentLanguage || "en");
  const [selectedLetterHead, setSelectedLetterHead] = useState<string>(letterHeadId || "");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Get documents for the doctype
  const { docs: documents, loading: docsLoading } = useDocList({
    doctype: doctype as Zodula.DoctypeName,
    limit: 100,
    sort: "updated_at",
    order: "desc",
  }, [doctype]);

  // Get letter heads
  const { docs: letterHeads } = useDocList({
    doctype: "zodula__Letter Head",
    limit: 1000,
    filters: [["disabled", "!=", 1]],
    sort: "is_default",
    order: "desc",
  });

  // Get selected document
  const { doc: selectedDoc } = useDoc({
    doctype: doctype as Zodula.DoctypeName,
    id: selectedDocId,
  }, [doctype, selectedDocId]);

  // Generate preview URL
  const generatePreview = useCallback(async () => {
    if (!doctype || !selectedDocId) {
      setError(t("Please select a document"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (templateId) {
        params.append("print_template", templateId);
      } else {
        // For unsaved templates, we need to save first or use a different approach
        // For now, show an error message
        setError(t("Please save the template first to preview with real data"));
        setPreviewUrl("");
        setIsLoading(false);
        return;
      }
      
      params.append("doctype", doctype);
      params.append("ids", selectedDocId);
      
      if (selectedLang) {
        params.append("lang", selectedLang);
      }
      
      if (selectedLetterHead) {
        params.append("letter_head", selectedLetterHead);
      }
      
      // Request HTML format for cleaner preview (no PDF viewer controls)
      params.append("format", "html");
      
      // Add cache-busting timestamp to prevent browser caching
      params.append("t", String(new Date().getTime()));
      
      const url = `/api/action/zodula.print.pdf?${params.toString()}`;
      
      // Fetch the preview to check for errors before setting iframe src
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        const errorMessage = errorData.message || errorData.error || t("Failed to generate preview");
        setError(errorMessage);
        setPreviewUrl("");
        console.error("[Preview] Server error:", errorData);
      } else {
        // Check if response is HTML (for preview) or PDF
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          // If we get JSON, it's an error response
          const errorData = await response.json();
          const errorMessage = errorData.message || errorData.error || t("Failed to generate preview");
          setError(errorMessage);
          setPreviewUrl("");
          console.error("[Preview] Error in response:", errorData);
        } else {
          // Response is OK, set preview URL
          setPreviewUrl(url);
          setError("");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("Failed to generate preview");
      setError(errorMessage);
      setPreviewUrl("");
      console.error("[Preview] Network error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId, doctype, selectedDocId, selectedLang, selectedLetterHead, layout, t]);

  // Initialize selected letter head from prop
  useEffect(() => {
    if (letterHeadId) {
      setSelectedLetterHead(letterHeadId);
    }
  }, [letterHeadId]);

  // Auto-generate preview when document is selected
  useEffect(() => {
    if (selectedDocId && (templateId || layout) && open) {
      generatePreview();
    }
  }, [selectedDocId, templateId, layout, open, generatePreview]);

  if (!open) return null;

  return (
    <div className="zd:fixed zd:inset-0 zd:bg-black zd:bg-opacity-50 zd:z-50 zd:flex zd:items-center zd:justify-center zd:p-4">
      <div className="zd:bg-white zd:rounded-lg zd:shadow-xl zd:w-full zd:max-w-6xl zd:h-[90vh] zd:flex zd:flex-col">
        {/* Header */}
        <div className="zd:flex zd:items-center zd:justify-between zd:px-6 zd:py-4 zd:border-b zd:border-muted">
          <div className="zd:flex zd:items-center zd:gap-4">
            <Eye className="zd:w-5 zd:h-5 zd:text-gray-600" />
            <h2 className="zd:text-xl zd:font-semibold">Preview Template</h2>
          </div>
          <Button
            variant="ghost"
            onClick={() => onOpenChange?.(false)}
            className="zd:p-2"
          >
            <X className="zd:w-5 zd:h-5" />
          </Button>
        </div>

        {/* Controls */}
        <div className="zd:px-6 zd:py-4 zd:border-b zd:border-border zd:bg-muted/30">
          <div className="zd:space-y-4">
            <div className="zd:grid zd:grid-cols-4 zd:gap-4">
              <div className="zd:flex-1">
                <label className="zd:text-sm zd:font-medium zd:mb-2 zd:block">
                  {t("Select Document")}
                </label>
                <Select
                  value={selectedDocId}
                  onChange={(value) => setSelectedDocId(value)}
                  options={[
                    { value: "", label: t("Select a document...") },
                  ...documents.map((doc) => ({
                    value: doc.id,
                    label: doc.id,
                    subtitle: (doc as any).name || (doc as any).label || "",
                  })),
                  ]}
                  disabled={docsLoading || !doctype}
                />
              </div>
              <div>
                <label className="zd:text-sm zd:font-medium zd:mb-2 zd:block">
                  {t("Language")}
                </label>
                <Select
                  value={selectedLang}
                  onChange={(value) => setSelectedLang(value)}
                  options={[
                    ...availableLanguages.map((lang) => ({
                      value: lang.code || "",
                      label: `${lang.flag || ""} ${lang.name || lang.code || ""}`.trim(),
                    })),
                  ]}
                />
              </div>
              <div>
                <label className="zd:text-sm zd:font-medium zd:mb-2 zd:block">
                  {t("Letter Head")}
                </label>
                <Select
                  value={selectedLetterHead}
                  onChange={(value) => setSelectedLetterHead(value)}
                  options={[
                    { value: "", label: t("None") },
                    ...letterHeads.map((lh) => ({
                      value: lh.id,
                      label: lh.name || lh.id,
                    })),
                  ]}
                />
              </div>
              <div className="zd:flex zd:items-end">
                <Button
                  onClick={generatePreview}
                  disabled={!selectedDocId || isLoading || (!templateId && !layout)}
                  className="zd:w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="zd:w-4 zd:h-4 zd:mr-2 zd:animate-spin" />
                      {t("Generating...")}
                    </>
                  ) : (
                    <>
                      <Eye className="zd:w-4 zd:h-4 zd:mr-2" />
                      {t("Preview")}
                    </>
                  )}
                </Button>
              </div>
            </div>
            {error && (
              <div className="zd:text-sm zd:text-red-600">{error}</div>
            )}
          </div>
        </div>

        {/* Preview Content */}
        <div className="zd:flex-1 zd:overflow-auto zd:bg-muted/20 zd:p-4">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              className="zd:w-full zd:h-full zd:border zd:border-border zd:rounded zd:bg-background"
              title="Template Preview"
              onLoad={() => {
                // Clear error when iframe loads successfully
                setError("");
              }}
              onError={() => {
                setError(t("Failed to load preview. Please check if the document exists."));
              }}
            />
          ) : (
            <div className="zd:flex zd:items-center zd:justify-center zd:h-full zd:text-gray-400">
              <div className="zd:text-center">
                <Eye className="zd:w-12 zd:h-12 zd:mx-auto zd:mb-4 zd:opacity-50" />
                <p className="zd:text-lg zd:mb-2">{t("No preview available")}</p>
                <p className="zd:text-sm">
                  {!templateId
                    ? t("Please save the template first to preview")
                    : !selectedDocId
                    ? t("Please select a document to preview")
                    : t("Click Preview to generate")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to open preview in a popup
export function usePrintTemplatePreview() {
  const openPreview = useCallback(
    (props: Omit<PrintTemplatePreviewProps, "open" | "onOpenChange">) => {
      return popup(
        ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
          <PrintTemplatePreview {...props} open={isOpen} onOpenChange={onClose} />
        ),
        {
          title: "Preview Template",
          description: "Preview the template with real document data",
        }
      );
    },
    []
  );

  return { openPreview };
}

