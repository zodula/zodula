import { generatePrintItemCss, PAGE_FORMATS, tabsToTemplateItem, templateItemToHtml, type TemplateItemForPrint } from "@/zodula/client/code-utils";
import { z } from "bxo";
import puppeteer, { Browser } from "puppeteer";
import { JSDOM } from "jsdom"
// @ts-ignore - binba may not have type definitions
import { Template } from "binba"
import { PDFDocument } from "pdf-lib";
import { ZodulaDoctypeHelper } from "@/zodula/server/zodula/doc/helper";
import { ErrorWithCode } from "@/zodula/error";
import { loader } from "@/zodula/server/loader";
import { ZodulaSDK } from "@/zodula/server/zodula/index";
import QRCode from "qrcode";

const pxToMm = (px: number) => px * 25.4 / 96;
const mmToPx = (mm: number) => mm * 96 / 25.4;

/** When Print Template is missing or margin fields are unset (mm). Explicit `0` still applies. */
const DEFAULT_PDF_MARGIN_MM = 10;

function encodeLogoUrlForHtml(src: string): string {
    const s = String(src).trim();
    if (!s || !/\s/.test(s)) return s;
    return encodeURI(s);
}

/** Chromium PDF header/footer templates often skip network loads; inline http(s) logos so they print. */
async function fetchHttpImageAsDataUrl(url: string): Promise<string | null> {
    const u = String(url).trim();
    if (!u || u.startsWith("data:") || !/^https?:\/\//i.test(u)) return null;
    try {
        const fetchUrl = /\s/.test(u) ? encodeURI(u) : u;
        const res = await fetch(fetchUrl);
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        const ct =
            res.headers.get("content-type")?.split(";")[0]?.trim() ||
            guessImageMimeFromUrl(u);
        return `data:${ct};base64,${buf.toString("base64")}`;
    } catch {
        return null;
    }
}

function guessImageMimeFromUrl(u: string): string {
    const path = u.split("?")[0]?.toLowerCase() ?? "";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".gif")) return "image/gif";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".svg")) return "image/svg+xml";
    return "image/png";
}

/** Match QR image pixel size in PDF (also min height for title row when QR is on). */
const PDF_QR_SIZE_PX = 56;
/** Space below the header band so QR/title never touch the letterhead rule (Chromium PDF body starts flush). */
const PDF_BODY_TOP_GAP_PX = 20;

/**
 * Place QR beside `.print-doc-heading` in a flex row so its height matches the title block
 * and it does not sit under the letterhead band. Returns unchanged HTML if no heading wrapper.
 */
function embedQrInPrintHeadingRow(html: string, qrDataUrl: string): { html: string; embedded: boolean } {
    if (!qrDataUrl || !html.includes("print-doc-heading")) {
        return { html, embedded: false };
    }
    try {
        const dom = new JSDOM(`<div class="pdf-parse-root">${html}</div>`);
        const root = dom.window.document.querySelector(".pdf-parse-root");
        const heading = root?.querySelector(".print-doc-heading");
        if (!root || !heading?.parentNode) return { html, embedded: false };

        const row = dom.window.document.createElement("div");
        row.className = "doc-print-heading-row";
        heading.parentNode.insertBefore(row, heading);
        row.appendChild(heading);

        const qr = dom.window.document.createElement("div");
        qr.className = "doc-qrcode";
        qr.setAttribute("aria-hidden", "true");
        const img = dom.window.document.createElement("img");
        img.setAttribute("src", qrDataUrl);
        img.setAttribute("alt", "");
        img.setAttribute("width", String(PDF_QR_SIZE_PX));
        img.setAttribute("height", String(PDF_QR_SIZE_PX));
        qr.appendChild(img);
        row.appendChild(qr);

        return { html: root.innerHTML, embedded: true };
    } catch {
        return { html, embedded: false };
    }
}

export default $action(async ctx => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }).catch(e => {
        throw new ErrorWithCode("Failed to launch browser", {
            status: 500,
        });
    });
    try {
        const { doctype, print_template, ids: idsString, lang, letter_head } = ctx.query;
        const ids = idsString ? JSON.parse(idsString) : [];

        const newZodula = new ZodulaSDK();
        newZodula.set_lang(lang);

        const doctypeDoc = loader.from("doctype").get(doctype as any);
        const printTemplateDoc = print_template ? await $zodula.doctype("Print Template").get(print_template as any) : null;
        const letterHeadDoc = letter_head ? await $zodula.doctype("Letter Head").get(letter_head as any) : null;
        const globalSettingDoc = await $zodula
            .doctype("Global Setting")
            .get("Global Setting")
            .bypass(true)
            .fields(["doc_status_watermark"]);

        const printTemplateHeightmm = printTemplateDoc?.custom_height ?? PAGE_FORMATS[printTemplateDoc?.format ?? "A4"]?.height ?? 297;
        const printTemplateHeightpx = printTemplateHeightmm * 96 / 25.4;
        const printTemplateWidthmm = printTemplateDoc?.custom_width ?? PAGE_FORMATS[printTemplateDoc?.format ?? "A4"]?.width ?? 210;
        const printTemplateWidthpx = printTemplateWidthmm * 96 / 25.4;
        const pdfMarginLeftPx = mmToPx(printTemplateDoc?.margin_left ?? DEFAULT_PDF_MARGIN_MM);
        const pdfMarginRightPx = mmToPx(printTemplateDoc?.margin_right ?? DEFAULT_PDF_MARGIN_MM);
        /** Width inside left/right PDF margins — match viewport; floor so content never exceeds printable width. */
        const pdfContentWidthPx = Math.max(
            320,
            Math.floor(printTemplateWidthpx - pdfMarginLeftPx - pdfMarginRightPx)
        );

        const hasLetterHeadBody =
            letterHeadDoc != null && String(letterHeadDoc.html_content ?? "").trim() !== "";

        const publicAppBase = (process.env.ZODULA_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
        /** Preload so letter head templates do not rely on binba chaining get().bypass(); File URLs from formatDocResult. */
        const orgLetterHeadCtxRaw = await $zodula.doctype("Organization").get("Organization").bypass(true);
        let orgLetterHeadCtx = orgLetterHeadCtxRaw;
        if (orgLetterHeadCtxRaw && (orgLetterHeadCtxRaw as { logo?: string }).logo) {
            const rawLogo = String((orgLetterHeadCtxRaw as { logo?: string }).logo ?? "");
            let logo = rawLogo.startsWith("data:") ? rawLogo : encodeLogoUrlForHtml(rawLogo);
            if (!rawLogo.startsWith("data:") && !/^https?:\/\//i.test(logo) && publicAppBase) {
                const path = logo.startsWith("/") ? logo : `/${logo}`;
                logo = `${publicAppBase}${path}`;
            }
            if (!rawLogo.startsWith("data:") && /^https?:\/\//i.test(logo)) {
                const inlined = await fetchHttpImageAsDataUrl(logo);
                if (inlined) logo = inlined;
            }
            orgLetterHeadCtx = { ...orgLetterHeadCtxRaw, logo };
        }

        const pdfBuffers = []

        for (const id of ids) {
            const doc = await $zodula.doctype(printTemplateDoc?.doctype || doctypeDoc.name as any).get(id as any).bypass(true)

            const { can } = await ZodulaDoctypeHelper.checkPermission(doctype as any, "can_get", doc, {
                bypass: false,
                doctype: doctypeDoc,
            });
            if (!can) {
                throw new ErrorWithCode("You do not have permission to get this document", {
                    status: 403,
                });
            }
            let html = "";
            let items: TemplateItemForPrint[] | null = null;
            let title = "";
            let subtitle = "";
            if (!print_template) {
                // Tab layout → print HTML via tabsToTemplateItem / templateItemToHtml in code-utils
                // (empty cells render as visible placeholders; hide_no_value omits a field only when set and value is empty).
                if (doctypeDoc.config.tabs) {
                    items = tabsToTemplateItem(doctypeDoc);
                }
                title = doctypeDoc.config.label ?? "";
                subtitle = id ?? "";
            } else {
                if (printTemplateDoc?.is_html === 1) {
                    html = await Template.render(printTemplateDoc?.html_content ?? "", { doc, zodula: newZodula, env: process.env });
                } else {
                    // Template items may include nested_table_field and nested_table_field_doctype for nested table columns (manual override when schema cannot be loaded).
                    items = (printTemplateDoc?.print_template_items as any) || [];
                    title = await Template.render(printTemplateDoc?.title ?? "", { doc, zodula: newZodula, env: process.env });
                    subtitle = await Template.render(printTemplateDoc?.doc_name_expression ?? "", { doc, zodula: newZodula, env: process.env });
                }
            }

            if (items) {
                html = await templateItemToHtml(doctypeDoc.name as any, items as any, doc, {
                    title,
                    subtitle,
                    language: lang ?? "en",
                    fetchRefDoc: async (d: string, id: string) => {
                        try {
                            return await $zodula.doctype(d as any).get(id as any);
                        } catch {
                            return null;
                        }
                    },
                });
            }

            const isSubmittable = doctypeDoc.config.is_submittable === 1;
            const docStatus = (doc as { doc_status?: string })?.doc_status;
            const orgWatermarkEnabled = (globalSettingDoc as { doc_status_watermark?: number } | null)?.doc_status_watermark !== 0;
            const showStatusWatermark = isSubmittable && docStatus && docStatus !== "Submitted" && orgWatermarkEnabled;
            const statusLabel = docStatus === "Cancelled" ? "Cancelled" : "Draft";
            const statusColor = docStatus === "Cancelled" ? "red" : "black";

            const page = await browser.newPage();
            /** Match body column: same px width as viewport + same left offset as PDF margin (not full page width + mm padding). */
            const letterHeadHtml = await Template.render(`
                ${publicAppBase ? `<base href="${publicAppBase}/" />` : ""}
                <style>
                    .letter-head {
                        box-sizing: border-box;
                        width: ${pdfContentWidthPx}px;
                        margin-left: ${pdfMarginLeftPx}px;
                        padding-top: ${(printTemplateDoc?.margin_top ?? DEFAULT_PDF_MARGIN_MM)}mm;
                        ${hasLetterHeadBody ? `margin-bottom: ${DEFAULT_PDF_MARGIN_MM}mm;` : ""}
                        font-family: Arial, sans-serif;
                    }
                </style>
                <div class="letter-head">
                    ${letterHeadDoc?.html_content ?? ""}
                </div>
                `, { doc, zodula: newZodula, org: orgLetterHeadCtx, env: process.env, publicAppBase });

            const footerHtml = await Template.render(`
                ${publicAppBase ? `<base href="${publicAppBase}/" />` : ""}
                <style>
                    .footer {
                        box-sizing: border-box;
                        width: ${pdfContentWidthPx}px;
                        margin-left: ${pdfMarginLeftPx}px;
                        padding-bottom: ${(printTemplateDoc?.margin_bottom ?? DEFAULT_PDF_MARGIN_MM) + 2}mm;
                        font-family: Arial, sans-serif;
                    }
                </style>
                <div class="footer">
                    ${letterHeadDoc?.html_footer_content ?? ""}
                </div>
            `, { doc, zodula: newZodula, org: orgLetterHeadCtx, env: process.env, publicAppBase });
            const letterHeadPage = await browser.newPage();
            await letterHeadPage.setViewport({
                width: Math.max(320, Math.round(printTemplateWidthpx)),
                height: 400,
                deviceScaleFactor: 1,
            });
            await letterHeadPage.setContent(letterHeadHtml, { waitUntil: "load" });
            const letterHeadHeightPx = await letterHeadPage.evaluate(() => {
                return document.querySelector(".letter-head")?.clientHeight ?? 0;
            });
            await letterHeadPage.close();
            const footerPage = await browser.newPage();
            await footerPage.setViewport({
                width: Math.max(320, Math.round(printTemplateWidthpx)),
                height: 400,
                deviceScaleFactor: 1,
            });
            await footerPage.setContent(footerHtml, { waitUntil: "load" });
            const footerHeightPx = await footerPage.evaluate(() => {
                return document.querySelector(".footer")?.clientHeight ?? 0;
            });
            await footerPage.close();
            const showQr = (printTemplateDoc as any)?.show_id_qrcode === 1 || doctypeDoc.config?.default_show_id_qrcode === 1;
            const qrData = String(id ?? "");
            const qrDataUrl = showQr ? await QRCode.toDataURL(qrData, { width: PDF_QR_SIZE_PX, margin: 0 }) : "";
            let bodyHtml = html;
            let qrInHeadingRow = false;
            if (showQr && qrDataUrl) {
                const r = embedQrInPrintHeadingRow(html, qrDataUrl);
                bodyHtml = r.html;
                qrInHeadingRow = r.embedded;
            }

            const pageContent = `
                <style>
                    ${generatePrintItemCss(items as any)}
                    html, body {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                    }
                    .doc-status-watermark {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        pointer-events: none;
                    }
                    .doc-status-watermark span {
                        font-size: 120px;
                        font-weight: bold;
                        opacity: 0.2;
                    }
                    .doc-print-root {
                        position: relative;
                        box-sizing: border-box;
                        width: 100%;
                    }
                    .doc-print-root--qr-row {
                        padding-top: ${PDF_BODY_TOP_GAP_PX}px;
                        box-sizing: border-box;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row {
                        display: flex;
                        flex-direction: row;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 12px;
                        min-height: ${PDF_QR_SIZE_PX}px;
                        box-sizing: border-box;
                        width: 100%;
                        max-width: 100%;
                        margin-top: 0;
                        margin-bottom: 0;
                        padding-right: 4px;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row .print-doc-heading {
                        flex: 1 1 0;
                        min-width: 0;
                        max-width: 100%;
                        overflow: hidden;
                        min-height: ${PDF_QR_SIZE_PX}px;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        margin-top: 0 !important;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row .doc-qrcode {
                        flex: 0 0 auto;
                        align-self: flex-start;
                        margin: 0;
                        padding: 0;
                        line-height: 0;
                        width: ${PDF_QR_SIZE_PX}px;
                        max-width: ${PDF_QR_SIZE_PX}px;
                        box-sizing: border-box;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row .doc-qrcode img {
                        width: ${PDF_QR_SIZE_PX}px;
                        height: ${PDF_QR_SIZE_PX}px;
                        display: block;
                        object-fit: contain;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row .print-title {
                        margin-top: 0;
                        margin-bottom: 4px;
                    }
                    .doc-print-root--qr-row .doc-print-heading-row .print-subtitle {
                        margin-bottom: 0;
                    }
                    .doc-print-root--qr-fallback {
                        padding-top: ${PDF_BODY_TOP_GAP_PX}px;
                        box-sizing: border-box;
                    }
                    .doc-print-root--qr-fallback .doc-qrcode--fixed {
                        position: fixed;
                        top: ${PDF_BODY_TOP_GAP_PX}px;
                        right: 6px;
                        z-index: 30;
                        margin: 0;
                        padding: 0;
                        line-height: 0;
                        box-sizing: border-box;
                    }
                    .doc-print-root--qr-fallback .doc-qrcode--fixed img {
                        width: ${PDF_QR_SIZE_PX}px;
                        height: ${PDF_QR_SIZE_PX}px;
                        display: block;
                    }
                    .doc-print-root--qr-fallback h1.print-title,
                    .doc-print-root--qr-fallback p.print-subtitle,
                    .doc-print-root--qr-fallback .print-body > .print-row:first-of-type {
                        padding-right: ${PDF_QR_SIZE_PX + 8}px;
                        box-sizing: border-box;
                    }
                </style>
                <div class="doc-print-root${showQr && qrInHeadingRow ? " doc-print-root--qr-row" : ""}${showQr && !qrInHeadingRow ? " doc-print-root--qr-fallback" : ""}">
                    ${showQr && !qrInHeadingRow ? `
                    <div class="doc-qrcode doc-qrcode--fixed" aria-hidden="true">
                      <img src="${qrDataUrl}" alt="" />
                    </div>
                    ` : ""}
                    <div>${bodyHtml}</div>
                    ${showStatusWatermark ? `
                    <div class="doc-status-watermark">
                        <span style="color: ${statusColor};">${statusLabel}</span>
                    </div>
                    ` : ""}
                </div>
                `;
            await page.setViewport({
                width: pdfContentWidthPx,
                height: Math.min(2000, Math.round(printTemplateHeightpx)),
                deviceScaleFactor: 1,
            });
            await page.setContent(pageContent);
            const pdf = await page.pdf({
                displayHeaderFooter: true,
                format: "A4",
                headerTemplate: `
                <style>
                    .letter-head {
                        font-size: 16px;
                        position: fixed;
                        top: 0;
                    }
                </style>
               ${letterHeadHtml}
                `,
                footerTemplate: `
                <style>
                    .footer {
                        font-size: 16px;
                        position: fixed;
                        bottom: 0;
                    }
                </style>
                ${footerHtml}
                `,
                margin: {
                    top: letterHeadHeightPx,
                    right: pdfMarginRightPx,
                    bottom: footerHeightPx,
                    left: pdfMarginLeftPx,
                }
            });
            pdfBuffers.push(pdf);
        }

        const mergedPdf = await PDFDocument.create();
        for (const pdfBuffer of pdfBuffers) {
            const pdf = await PDFDocument.load(pdfBuffer);
            const copiedPages = await mergedPdf.copyPages(
                pdf,
                pdf.getPageIndices()
            );
            for (const page of copiedPages) {
                mergedPdf.addPage(page);
            }
        }

        const mergedPdfBuffer = await mergedPdf.save();


        await browser.close();
        return new Response(mergedPdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline; filename=document.pdf",
            },
        });
    } catch (e: any) {
        throw new ErrorWithCode(e?.message ?? "Failed to generate PDF", {
            status: 500,
        });
    }
    finally {
        await browser.close();
    }
}, {
    query: z.object({
        doctype: z.string().optional(),
        print_template: z.string().optional(),
        ids: z.string().optional(),
        lang: z.string().optional(),
        letter_head: z.string().optional(),
    }),
    method: "GET"
})