export default $doctype<"Print Setting">({
  default_lang: {
    type: "Reference",
    label: "Default Language",
    reference: "Language",
    required: 0,
    description: "Default language for the desk print preview and PDF generation.",
  },
  default_letter_head: {
    type: "Reference",
    label: "Default Letter Head",
    reference: "Letter Head",
    required: 0,
    description:
      "Used when the default print template for a doctype has no letter head set.",
  },
}, {
  label: "Print Setting",
  is_single: 1,
  tabs: JSON.stringify([
    {
      type: "Tab",
      label: "General",
      layout: [
        { type: "section", value: "Print", align: "left" },
        [
          { type: "field", value: "default_lang", align: "left" },
          { type: "field", value: "default_letter_head", align: "left" },
        ],
      ],
    },
  ]),
})
