import { useEffect, useMemo, useState } from "react";
import { NavbarLayout } from "@/zodula/ui/layout/navbar-layout";
import { SidebarLayout } from "@/zodula/ui/layout/sidebar-layout";
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
  fromOrganization: string;
}) {
  if (!params.doctype || params.ids.length === 0) return "";
  const q = new URLSearchParams();
  q.set("doctype", params.doctype);
  q.set("print_template", params.printTemplate);
  q.set("ids", JSON.stringify(params.ids));
  q.set("letter_head", params.letterHead);
  q.set("lang", params.lang);
  q.set("from_organization", params.fromOrganization);
  const url = new URL("/api/action/zodula.core.pdf", window.location.origin);
  url.search = q.toString();
  return url.toString();
}

export default function PrintPage() {
  const { params } = useRouter();
  const org = (params as { org?: string }).org ?? "";
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
      fromOrganization: org,
    });
  }, [defaultsLoaded, doctype, ids, printTemplate, letterHead, lang]);

  useEffect(() => {
    if (!doctype || ids.length === 0) {
      setDefaultsLoaded(true);
      return;
    }
    setDefaultsLoaded(false);
    const loadDefaults = async () => {
      const [printRes, orgDoc] = await Promise.all([
        zodula.doc.select_docs("Print Template", {
          filters: [["is_default", "=", 1], ["doctype", "=", doctype]],
          limit: 1,
          sort: "name",
          order: "asc",
        }),
        org ? zodula.doc.get_doc("Organization", org, { fields: ["default_lang"] }) : null,
      ]);
      const defaultPrintTemplate = printRes.docs[0];
      const defaultLang =
        defaultPrintTemplate?.default_language ?? (orgDoc as { default_lang?: string } | null)?.default_lang ?? "";
      setPrintTemplate(defaultPrintTemplate?.id ?? "");
      setLang(defaultLang);
      setLetterHead(defaultPrintTemplate?.default_letter_head ?? "");
    };
    loadDefaults().finally(() => setDefaultsLoaded(true));
  }, [doctype, ids.length, org]);

  const subtitle =
    doctype && ids.length > 0
      ? `${doctype} (${ids.length} document${ids.length !== 1 ? "s" : ""})`
      : undefined;

  const sidebarContent = (
    <div className="zd:flex zd:flex-col zd:gap-4 zd:p-2">
      <FormControl
        label="Print Template"
        fieldKey="print_template"
        field={{ type: "Reference", reference: "Print Template" }}
        value={printTemplate}
        onChange={(_k, v) => setPrintTemplate(v ?? "")}
        org={org}
      />
      <FormControl
        label="Language"
        fieldKey="lang"
        field={{ type: "Reference", reference: "Language" }}
        value={lang}
        onChange={(_k, v) => setLang(v ?? "")}
        org={org}
      />
      <FormControl
        label="Letter Head"
        fieldKey="letter_head"
        field={{ type: "Reference", reference: "Letter Head" }}
        value={letterHead}
        onChange={(_k, v) => setLetterHead(v ?? "")}
        org={org}
      />
    </div>
  );

  return (
    <NavbarLayout>
      <SidebarLayout
        title="Print"
        subtitle={subtitle}
        sidebarContent={sidebarContent}
        defaultOpen
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
                : "Add doctype and ids to the URL (e.g. ?doctype=Delivery%20Manifest&ids=[\"DOC-001\"])"}
            </div>
          )}
        </div>
      </SidebarLayout>
    </NavbarLayout>
  );
}
