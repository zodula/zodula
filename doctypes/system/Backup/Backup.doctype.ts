export default $doctype<"Backup">(
  {
    backup_files: {
      type: "Reference Table",
      label: "Backup Files",
      reference: "Backup File",
      required: 0,
    },
  },
  {
    label: "Backup",
    is_single: 1,
    tabs: JSON.stringify([
      {
        type: "Tab",
        label: "Main",
        layout: [
          [{ type: "field", value: "backup_files", align: "left" }],
        ],
      },
    ]),
  }
);
