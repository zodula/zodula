export default $doctype<"Report Item">({
  doctype_field: {
    type: "Text",
    label: "Doctype Field",
    required: 1,
    in_list_view: 1,
    filters: JSON.stringify([["doctype", "=", "{{doctype}}"]]),
  },
  label: {
    type: "Text",
    label: "Label",
    in_list_view: 1,
  },
  sortable: {
    type: "Check",
    label: "Sortable",
    default: "1",
    in_list_view: 1,
  },
}, {
  label: "Report Item",
  is_child_doctype: 1,
  is_quick_entry: 1,
  search_fields: "parentid\ndoctype_field\nlabel",
});
