export default $doctype<"Backup File">(
  {
    date_time: {
      type: "DateTime",
      label: "Date Time",
      required: 1,
      default: "NOW()",
      in_list_view: 1,
    },
    file: {
      type: "File",
      label: "File",
      required: 1,
      accept: ".zip,application/zip",
      in_list_view: 1,
    },
  },
  {
    label: "Backup File",
    is_child_doctype: 1,
    search_fields: "date_time\nfile",
  }
);
