export default $doctype({
  name: $f.Text({
    label: "Name",
    required: 1,
    unique: 1
  }),
  description: $f.Text({
    label: "Description"
  })
}, {
  naming_series: "{{name}}",
  label: "Role"
});