import { useEffect, useMemo, useState } from "react";
import { DeskNavbarLayout } from "@/zodula/ui/layout/desk-navbar-layout";
import { FormControl } from "@/zodula/ui/components/ui/form-control";
import { useRouter } from "@/zodula/ui/components/router";
import { zodula } from "@/zodula/client";

function usePrintParams() {
  const { search } = useRouter();
  const doctype = search.doctype ?? "";
  const idsRaw = search.ids ?? "[]";
  const ids = useMemo(() => {
    try {
      const parsed = JSON.parse(idsRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [idsRaw]);
  return { doctype, ids };
}

function buildPdfUrl(params: {
  doctype: string;
  ids: string[];
  printTemplate: string;
  letterHead: string;
  lang: string;
}) {
  if (!params.doctype || params.ids.length === 0) return "";
  const q = new URLSearchParams();
  q.set("doctype", params.doctype);
  q.set("print_template", params.printTemplate);
  q.set("ids", JSON.stringify(params.ids));
  q.set("letter_head", params.letterHead);
  q.set("lang", params.lang);
  const url = new URL("/api/action/zodula.core.pdf", window.location.origin);
  url.search = q.toString();
  return url.toString();
}

export default function PrintPage() {
  const { params } = useRouter();
  const { doctype, ids } = usePrintParams();

  const [printTemplate, setPrintTemplate] = useState("");
  const [letterHead, setLetterHead] = useState("");
  const [lang, setLang] = useState("");
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  const pdfUrl = useMemo(() => {
    if (!defaultsLoaded) return "";
    return buildPdfUrl({
      doctype,
      ids,
      printTemplate,
      letterHead,
      lang,
    });
  }, [defaultsLoaded, doctype, ids, printTemplate, letterHead, lang]);

  useEffect(() => {
    if (!doctype || ids.length === 0) {
      setDefaultsLoaded(true);
      return;
    }
    setDefaultsLoaded(false);
    const loadDefaults = async () => {
      const [printRes, printSetting] = await Promise.all([
        zodula.doc.select_docs("Print Template", {
          filters: [["is_default", "=", 1], ["doctype", "=", doctype]],
          limit: 1,
          sort: "name",
          order: "asc",
        }),
        zodula.doc
          .get_doc("Print Setting" as Zodula.DoctypeName, "Print Setting")
          .catch(() => null),
      ]);
      const defaultPrintTemplate = printRes.docs[0];
      const ps = printSetting as {
        default_lang?: string | null;
        default_letter_head?: string | null;
      } | null;
      const defaultLang = ps?.default_lang ?? "";
      const letterHeadFromTemplate = String(
        defaultPrintTemplate?.default_letter_head ?? ""
      ).trim();
      const letterHeadFallback = String(ps?.default_letter_head ?? "").trim();
      setPrintTemplate(defaultPrintTemplate?.id ?? "");
      setLang(defaultLang);
      setLetterHead(letterHeadFromTemplate || letterHeadFallback);
    };
    loadDefaults().finally(() => setDefaultsLoaded(true));
  }, [doctype, ids.length]);

  const subtitle =
    doctype && ids.length > 0
      ? `${doctype} (${ids.length} document${ids.length !== 1 ? "s" : ""})`
      : undefined;

  const sidebarContent = (
    <div className="zd:flex zd:flex-col zd:gap-4">
      <FormControl
        label="Print Template"
        fieldKey="print_template"
        field={{ type: "Reference", reference: "Print Template", filters: JSON.stringify([["doctype", "=", doctype]]) }}
        value={printTemplate}
        onChange={(_k, v) => setPrintTemplate(v ?? "")}
      />
      <FormControl
        label="Language"
        fieldKey="lang"
        field={{ type: "Reference", reference: "Language" }}
        value={lang}
        onChange={(_k, v) => setLang(v ?? "")}
      />
      <FormControl
        label="Letter Head"
        fieldKey="letter_head"
        field={{ type: "Reference", reference: "Letter Head" }}
        value={letterHead}
        onChange={(_k, v) => setLetterHead(v ?? "")}
      />
    </div>
  );

  return (
    <DeskNavbarLayout
      title="Print"
      subtitle={subtitle}
      rightSidebar={sidebarContent}
      primaryAction={
        pdfUrl
          ? {
            label: "Open PDF",
            onClick: () => window.open(pdfUrl, "_blank"),
          }
          : undefined
      }
    >
      <div className="zd:h-full zd:min-h-0 zd:flex zd:flex-col">
        {pdfUrl ? (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title="PDF"
            className="zd:w-full zd:flex-1 zd:min-h-0 zd:border-0 zd:rounded"
          />
        ) : (
          <div className="zd:flex zd:items-center zd:justify-center zd:h-64 zd:text-muted-foreground">
            {doctype && ids.length > 0
              ? !defaultsLoaded
                ? "Loading default print template..."
                : "Select Print Template and Letter Head to preview."
              : "Add doctype and ids to the URL (e.g. ?doctype=Delivery%20Trip&ids=[\"DOC-001\"])"}
          </div>
        )}
      </div>
    </DeskNavbarLayout>
  );
}
