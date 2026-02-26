export default $doctype({
  name: {
    type: "Text",
    label: "Name",
    required: 1,
    in_list_view: 1,
  },
  html_content: {
    type: "Code",
    options: "html",
    label: "HTML Content",
    description: "Main letter head HTML (binba template supported).",
  },
  html_footer_content: {
    type: "Code",
    options: "html",
    label: "HTML Footer Content",
    description: "HTML footer content.",
  },
  css_content: {
    type: "Code",
    options: "css",
    label: "CSS Content",
    description: "Extra CSS for letter head.",
  },
  repeat_every_page: {
    type: "Check",
    label: "Repeat on every page",
    default: "1",
    description: "When set (default), letter head is repeated on every page in PDF/print. When unchecked, letter head appears only on the first page.",
  },
  css_extra: {
    type: "Text",
    label: "CSS (Editor)",
    description: "Additional CSS from HTML builder.",
  },
}, {
  label: "Letter Head",
  is_quick_entry: 1,
  naming_series: "{{name}} - {{organization}}",
  tabs: JSON.stringify([
    {
      type: "Tab",
      label: "Main",
      layout: [
        { type: "section", value: "Basic", align: "left" },
        [
          { type: "field", value: "name", align: "left" },
          { type: "field", value: "repeat_every_page", align: "left" },
        ],
      ],
    },
  ]),
})