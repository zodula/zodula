export default $doctype<"Print Template">({
  print_template_items: {
    type: "Reference Table",
    label: "Print Template Items",
    reference: "Print Template Item",
    required: 0,
  },
  name: {
    type: "Text",
    label: "Name",
    required: 1,
    in_list_view: 1,
  },
  title: {
    type: "Text",
    label: "Title",
    in_list_view: 1,
  },
  is_html: {
    type: "Check",
    label: "Is HTML",
    default: "0",
    in_list_view: 1,
    description: "If set, template uses raw HTML/CSS/JS (ZodulaHtmlBuilder). Otherwise use structured builder (PrintTemplateBuilder).",
  },
  is_fixed_position: {
    type: "Check",
    label: "Fixed Position Layout",
    default: "1",
    in_list_view: 1,
  },
  show_id_qrcode: {
    type: "Check",
    label: "Show Document QR Code",
    default: "1",
    in_list_view: 0,
    description: "If set, show a QR code for the document ID next to the title.",
  },
  format: {
    type: "Select",
    label: "Page Format",
    options: "A4\nA3\nA5\nLetter\nLegal\nTabloid\nCustom",
    default: "A4",
    in_list_view: 1,
  },
  custom_width: {
    type: "Float",
    label: "Custom Width (mm)",
    required: 0,
  },
  custom_height: {
    type: "Float",
    label: "Custom Height (mm)",
    required: 0,
  },
  margin_top: {
    type: "Float",
    label: "Margin Top (mm)",
    default: "10",
  },
  margin_right: {
    type: "Float",
    label: "Margin Right (mm)",
    default: "10",
  },
  margin_bottom: {
    type: "Float",
    label: "Margin Bottom (mm)",
    default: "10",
  },
  margin_left: {
    type: "Float",
    label: "Margin Left (mm)",
    default: "10",
  },
  css: {
    type: "Text",
    label: "Custom CSS",
    description: "Extra CSS for this template.",
  },
  html_content: {
    type: "Text",
    label: "HTML Content",
    description: "Used when Is HTML is set. Raw HTML or binba template.",
  },
  css_content: {
    type: "Text",
    label: "CSS Content",
    description: "Used when Is HTML is set.",
  },
  js_content: {
    type: "Text",
    label: "JS Content",
    description: "Used when Is HTML is set.",
  },
  doctype: {
    type: "Reference",
    required: 1,
    label: "Doctype",
    reference: "Doctype",
    description: "Doctype this template is for (for non-HTML builder: field palette).",
    filters: JSON.stringify([["is_child_doctype", "!=", 1]]),
  },
  doc_name_expression: {
    type: "Text",
    label: "Doc name expression",
    description: "Binba expression for document title in structured builder, e.g. {{ doc.id }}.",
  },
  is_default: {
    type: "Check",
    label: "Is Default",
    default: "0",
    in_list_view: 1,
    description: "Use this template (and its default letter head / language) when opening the print page.",
  },
  default_letter_head: {
    type: "Reference",
    label: "Default Letter Head",
    reference: "Letter Head",
    required: 0,
    description: "Default letter head when this template is the default.",
  },
  default_language: {
    type: "Reference",
    label: "Default Language",
    reference: "Language",
    required: 0,
    description: "Default language when this template is the default.",
  },
}, {
  label: "Print Template",
  is_quick_entry: 1,
  search_fields: "name\ntitle",
  display_field: "name",
  naming_series: "{{name}} - {{doctype}}",
  tabs: JSON.stringify([
    {
      type: "Tab",
      label: "Main",
      layout: [
        { type: "section", value: "Print Template Items", align: "left" },
        [{ type: "field", value: "print_template_items", align: "left" }],
        { type: "section", value: "Print Template Configuration", align: "left" },
        [
          { type: "field", value: "is_default", align: "left" },
          { type: "field", value: "default_letter_head", align: "left" },
          { type: "field", value: "default_language", align: "left" },
          { type: "field", value: "show_id_qrcode", align: "left" },
        ],
        { type: "section", value: "Template", align: "left" },
        [
          { type: "field", value: "name", align: "left" },
          { type: "field", value: "title", align: "left" },
          { type: "field", value: "is_html", align: "left" },
          { type: "field", value: "doctype", align: "left" },
        ],
        { type: "section", value: "Page", align: "left" },
        [
          { type: "field", value: "is_fixed_position", align: "left" },
          { type: "field", value: "format", align: "left" },
          { type: "field", value: "custom_width", align: "left" },
          { type: "field", value: "custom_height", align: "left" },
          { type: "field", value: "margin_top", align: "left" },
          { type: "field", value: "margin_right", align: "left" },
          { type: "field", value: "margin_bottom", align: "left" },
          { type: "field", value: "margin_left", align: "left" },
        ],
        { type: "section", value: "Custom CSS (HTML mode)", align: "left" },
        [{ type: "field", value: "css", align: "left" }],
      ],
    },
  ]),
})
.on("before_insert", function(ctx) {
  ctx.doc.title = ctx.doc.doctype;
})
.on("before_save", async function(ctx) {
  if (ctx.doc.is_default === 1) {
    const templatesForDoctype = await $zodula.doctype("Print Template").select().where("doctype", "=", ctx.doc.doctype);
    for (const template of templatesForDoctype.docs) {
      await $zodula.doctype("Print Template").update(template.id, { is_default: 0 });
    }
  }
});