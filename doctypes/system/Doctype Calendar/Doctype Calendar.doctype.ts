export default $doctype<"Doctype Calendar">({
  name: {
    type: "Text",
    label: "Name",
    required: 1,
    in_list_view: 1,
  },
  doctype: {
    type: "Reference",
    label: "Doctype",
    reference: "Doctype",
    required: 1,
    in_list_view: 1,
    filters: JSON.stringify([["is_child_doctype", "!=", 1]]),
  },
  primary_date_doctype: {
    type: "Reference",
    label: "Primary Date Doctype",
    reference: "Doctype",
    required: 1,
    description: "Shown first on each day (e.g. holidays).",
  },
  primary_date_fieldname: {
    type: "Text",
    label: "Primary Date Field",
    required: 1,
    description: "Date or Datetime field on the primary doctype.",
  },
  secondary_date_doctype: {
    type: "Reference",
    label: "Secondary Date Doctype",
    reference: "Doctype",
    required: 1,
    description: "Additional items per day (e.g. attendance).",
  },
  secondary_date_fieldname: {
    type: "Text",
    label: "Secondary Date Field",
    required: 1,
    description: "Date or Datetime field on the secondary doctype.",
  },
  primary_value_field: {
    type: "Text",
    label: "Primary Chip Value Field",
    description:
      "Field on the primary doctype for the calendar chip main text. Leave empty to use that doctype’s display field.",
  },
  primary_sub_value_field: {
    type: "Text",
    label: "Primary Chip Sub Value Field",
    description:
      "Optional second field on the primary doctype; shown after “ · ” when set and non-empty.",
  },
  secondary_value_field: {
    type: "Text",
    label: "Secondary Chip Value Field",
    description:
      "Field on the secondary doctype for the chip main text. Leave empty to use that doctype’s display field.",
  },
  secondary_sub_value_field: {
    type: "Text",
    label: "Secondary Chip Sub Value Field",
    description:
      "Optional second field on the secondary doctype; shown after “ · ” when set and non-empty.",
  },
}, {
  label: "Doctype Calendar",
  is_quick_entry: 1,
  display_field: "name",
  search_fields: "name\ndoctype",
  naming_series: "{{doctype}} - {{name}}",
});
