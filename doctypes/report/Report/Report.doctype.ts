export default $doctype<"Report">({
  report_items: {
    type: "Reference Table",
    label: "Report Items",
    reference: "Report Item",
  },
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
  is_script: {
    type: "Check",
    label: "Is Script",
    default: "0",
    in_list_view: 1,
  },
  script: {
    type: "Code",
    label: "Script",
    options: "typescript",
    description: "Return { rows, columns } from script when Is Script is enabled.",
  },
  default_filters: {
    type: "Code",
    label: "Default Filters",
    options: "json",
    description: "Default filters JSON array, merged with request filters.",
  },
  aggregation: {
    type: "Code",
    label: "Aggregation",
    options: "json",
    description: "Default aggregation JSON object.",
  },
  sort: {
    type: "Text",
    label: "Sort",
    in_list_view: 1,
  },
  order: {
    type: "Select",
    label: "Order",
    options: "asc\ndesc",
    default: "desc",
    in_list_view: 1,
  },
}, {
  label: "Report",
  is_quick_entry: 1,
  search_fields: "name\ndoctype",
  display_field: "name",
  naming_series: "{{doctype}} - {{name}}",
});
