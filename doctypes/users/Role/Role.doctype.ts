export default $doctype({
  name: {
    type: "Text",
    label: "Name",
    required: 1,
    unique: 1
  },
  description: {
    type: "Text",
    label: "Description"
  },
  is_system: {
    type: "Check",
    label: "Is System",
    default: "0"
  }
}, {
  naming_series: "{{name}}",
  label: "Role",
});