export default $doctype(
  {
    name: {
      type: "Text",
      label: "Name",
      required: 1,
      unique: 1,
    },
    description: {
      type: "Text",
      label: "Description",
    },
    version: {
      type: "Text",
      label: "Version",
      required: 1,
    },
  },
  {
    label: "App",
    is_system_generated: 1,
    naming_series: "{{name}}",
  }
);