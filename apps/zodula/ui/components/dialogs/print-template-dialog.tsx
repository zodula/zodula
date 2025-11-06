import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { useDocList } from "@/zodula/ui/hooks/use-doc-list";
import { useTranslation } from "@/zodula/ui/hooks/use-translation";
import { Loader2, Printer } from "lucide-react";
import { FormControl } from "../ui/form-control";

interface PrintTemplateDialogProps {
  isOpen: boolean;
  onClose: (
    result?: { templateId: string; templateName: string } | null
  ) => void;
  initialData?: {
    doctype: Zodula.DoctypeName;
    docIds: string[];
  };
}

export function PrintTemplateDialog({
  isOpen,
  onClose,
  initialData,
}: PrintTemplateDialogProps) {
  const { t, currentLanguage } = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedLetterHead, setSelectedLetterHead] = useState<string | null>(
    null
  );
  const [lang, setLang] = useState<string>("en");
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch print templates for the current doctype
  const { docs: printTemplates, loading } = useDocList(
    {
      doctype: "zodula__Print Template",
      limit: 1000,
      filters: initialData?.doctype
        ? [["doctype", "=", initialData.doctype]]
        : [],
      sort: "is_default",
      order: "desc",
    },
    [initialData?.doctype]
  );

  // Fetch letter heads
  const { docs: letterHeads, loading: letterHeadsLoading } = useDocList({
    doctype: "zodula__Letter Head",
    limit: 1000,
    filters: [["disabled", "!=", 1]],
    sort: "is_default",
    order: "desc",
  });

  useEffect(() => {
    if (printTemplates?.length > 0) {
      setSelectedTemplate(printTemplates[0]?.id || null);
    }
    setLang(printTemplates[0]?.default_lang || currentLanguage || "en");
  }, [printTemplates]);

  useEffect(() => {
    if (letterHeads?.length > 0) {
      const defaultLetterHead = letterHeads.find((lh) => lh.is_default);
      setSelectedLetterHead(defaultLetterHead?.id || null);
    }
  }, [letterHeads]);

  const handlePrint = async () => {
    if (!initialData?.docIds) return;

    setIsPrinting(true);
    try {
      // Find the selected template
      const template = printTemplates?.find((t) => t.id === selectedTemplate);

      // Construct print URL
      const printUrl = `/api/action/zodula.print.pdf?${initialData.docIds.map((id) => `ids=${id}`).join("&")}&lang=${lang}&doctype=${initialData.doctype}${selectedTemplate ? `&print_template=${selectedTemplate}` : ""}${selectedLetterHead ? `&letter_head=${selectedLetterHead}` : ""}&t=${new Date().getTime()}`;

      // Open print window
      const printWindow = window.open(
        printUrl,
        "_blank",
        "width=800,height=600,scrollbars=yes,resizable=yes"
      );

      if (printWindow) {
        printWindow.focus();
        // Close dialog after opening print window
        onClose({
          templateId: selectedTemplate || "",
          templateName: template?.name || "",
        });
      }
    } catch (error) {
      console.error("Error opening print window:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleClose = () => {
    onClose(null);
  };

  return (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:p-1">
      <div className="zd:space-y-4">
        <div className="zd:flex zd:flex-col zd:gap-2">
          <FormControl
            label="Language"
            fieldKey="lang"
            type="Text"
            field={{
              type: "Reference",
              reference: "zodula__Language",
              default: "en",
            }}
            value={lang}
            onChange={(fieldName, value) => {
              setLang(value);
            }}
          />
          <FormControl
            label="Letter Head"
            fieldKey="letter_head"
            field={{
              type: "Reference",
              reference: "zodula__Letter Head",
              filters: JSON.stringify([["disabled", "!=", 1]]),
            }}
            onChange={(fieldName, value) => {
              setSelectedLetterHead(value);
            }}
            value={selectedLetterHead}
          />
          <FormControl
            label="Print Template"
            fieldKey="print_template"
            field={{
              type: "Reference",
              reference: "zodula__Print Template",
              filters: JSON.stringify([["doctype", "=", initialData?.doctype]]),
            }}
            onChange={(fieldName, value) => {
              setSelectedTemplate(value);
            }}
            value={selectedTemplate}
          />
        </div>

        <div className="zd:flex zd:justify-end zd:space-x-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isPrinting}
            className="zd:min-w-[100px]"
          >
            {isPrinting ? (
              <>
                <Loader2 className="zd:h-4 zd:w-4 zd:mr-2 zd:animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="zd:h-4 zd:w-4 zd:mr-2" />
                {selectedTemplate ? "Print" : "Default Print"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
