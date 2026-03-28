export default $doctype({
  role: {
    type: "Reference",
    label: "Role",
    reference: "Role",
    on_delete: "CASCADE",
    required: 1,
    unique: 1,
    group: "workspace-role",
    in_list_view: 1,
  },
}, {
  label: "Workspace Role",
  is_child_doctype: 1,
})
