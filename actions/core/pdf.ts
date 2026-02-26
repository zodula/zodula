import { generatePrintItemCss, PAGE_FORMATS, tabsToTemplateItem, templateItemToHtml, type TemplateItemForPrint } from "@/zodula/client/code-utils";
import { z } from "bxo";
import puppeteer, { Browser } from "puppeteer";
import { JSDOM } from "jsdom"
// @ts-ignore - binba may not have type definitions
import { Template } from "binba"
import { PDFDocument } from "pdf-lib";
import { ZodulaDoctypeHelper } from "@/zodula/server/zodula/doc/helper";
import { ErrorWithCode } from "@/zodula/error";
import { translate } from "@/zodula/server/zodula/utils";
import { loader } from "@/zodula/server/loader";

const pxToMm = (px: number) => px * 25.4 / 96;
const mmToPx = (mm: number) => mm * 96 / 25.4;

export default $action(async ctx => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
        const { doctype, print_template, ids: idsString, lang, letter_head } = ctx.query;
        const user = await $zodula.session.user();
        const userRoles = await $zodula.session.roles();
        const ids = idsString ? JSON.parse(idsString) : [];
        
        const doctypeDoc = loader.from("doctype").get(doctype as any);
        const printTemplateDoc = print_template ? await $zodula.doctype("Print Template").get(print_template as any) : null;
        const letterHeadDoc = letter_head ? await $zodula.doctype("Letter Head").get(letter_head as any) : null;
        
        const printTemplateHeightmm = printTemplateDoc?.custom_height ?? PAGE_FORMATS[printTemplateDoc?.format ?? "A4"]?.height ?? 297;
        const printTemplateHeightpx = printTemplateHeightmm * 96 / 25.4;
        const printTemplateWidthmm = printTemplateDoc?.custom_width ?? PAGE_FORMATS[printTemplateDoc?.format ?? "A4"]?.width ?? 210;
        const printTemplateWidthpx = printTemplateWidthmm * 96 / 25.4;

        const pdfBuffers = []

        for (const id of ids) {
            const doc = await $zodula.doctype(printTemplateDoc?.doctype || doctypeDoc.name as any).get(id as any);
        const can = await ZodulaDoctypeHelper.can(doctype as any, "can_get", doc.owner === user?.id, userRoles, false)
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
                if(doctypeDoc.config.tabs) {
                    items = tabsToTemplateItem(doctypeDoc);
                }
                title = doctypeDoc.config.label ?? "";
                subtitle = id ?? "";
            } else {
                if(printTemplateDoc?.is_html === 1) {
                    html = await Template.render(printTemplateDoc?.html_content ?? "", { doc, zodula: $zodula });
                }else {
                    items = (printTemplateDoc?.print_template_items as any) || [];
                    title = await Template.render(printTemplateDoc?.title ?? "", { doc, zodula: $zodula });
                    subtitle = await Template.render(printTemplateDoc?.doc_name_expression ?? "", { doc, zodula: $zodula });
                }
            }

            if(items) {
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

            const page = await browser.newPage();
                const letterHeadHtml = await Template.render(`
                <style>
                    .letter-head {
                        width: ${printTemplateWidthpx}px;
                        padding-top: ${(printTemplateDoc?.margin_top ?? 0)}mm;
                        padding-right: ${(printTemplateDoc?.margin_right ?? 0) + 2}mm;
                        padding-left: ${(printTemplateDoc?.margin_left ?? 0) + 2}mm;
                        font-family: Arial, sans-serif;
                    }
                </style>
                <div class="letter-head">
                    ${letterHeadDoc?.html_content ?? ""}
                </div>
                `, { doc, zodula: $zodula });

                const footerHtml = await Template.render(`
                <style>
                    .footer {
                        width: ${printTemplateWidthpx}px;
                        padding-bottom: ${(printTemplateDoc?.margin_bottom ?? 0) + 2}mm;
                        padding-left: ${(printTemplateDoc?.margin_left ?? 0) + 2}mm;
                        padding-right: ${(printTemplateDoc?.margin_right ?? 0) + 2}mm;
                        font-family: Arial, sans-serif;
                    }
                </style>
                <div class="footer">
                    ${letterHeadDoc?.html_footer_content ?? ""}
                </div>
            `, { doc, zodula: $zodula });
                const letterHeadPage = await browser.newPage();
                await letterHeadPage.setContent(letterHeadHtml);
                const letterHeadHeightPx = await letterHeadPage.evaluate(() => {
                    return document.querySelector(".letter-head")?.clientHeight ?? 0;
                });
                await letterHeadPage.close();
                const footerPage = await browser.newPage();
                await footerPage.setContent(footerHtml);
                const footerHeightPx = await footerPage.evaluate(() => {
                    return document.querySelector(".footer")?.clientHeight ?? 0;
                });
                await footerPage.close();
                const pageContent = `
                <style>
                    ${generatePrintItemCss(items as any)}
                </style>
                <div>
                    ${html}
                </div>
                `;
                await page.setContent(pageContent);
                const pdf = await page.pdf({
                    displayHeaderFooter: true,
                    path: "output.pdf",
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
                        right: mmToPx(printTemplateDoc?.margin_right ?? 0),
                        bottom: footerHeightPx,
                        left: mmToPx(printTemplateDoc?.margin_left ?? 0),
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