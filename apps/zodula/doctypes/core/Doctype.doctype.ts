export default $doctype(
  {
    app: {
      type: "Text",
      label: "App",
      required: 1,
      unique: 1,
      group: "group1",
    },
    name: {
      type: "Text",
      label: "Name",
      required: 1,
      unique: 1,
    },
    label: {
      type: "Text",
      label: "Label",
    },
    json_model: {
      type: "JSON",
      label: "JSON Model",
    },
    is_single: {
      type: "Check",
      label: "Is Single",
    },
    naming_series: {
      type: "Text",
      label: "Naming Series",
    },
    is_submittable: {
      type: "Check",
      label: "Is Submittable",
    },
    track_changes: {
      type: "Check",
      label: "Track Changes",
    },
    comments_enabled: {
      type: "Check",
      label: "Comments Enabled",
    },
    display_field: {
      type: "Text",
      label: "Display Field",
    },
    // field1\nfield2\nfield3
    search_fields: {
      type: "Text",
      label: "Search Fields",
    },
    is_system_generated: {
      type: "Check",
      label: "Is System Generated",
    },
    require_user_permission: {
      type: "Check",
      label: "Require User Permission",
    },

    tabs: {
      type: "JSON",
      label: "Tabs",
      description:
        "The tabs of the doctype. The tabs are defined as an array of objects with the following properties: name, label, layout. The layout is an array of objects with the following properties: type, value, align. The type is the type of the field and the value is the value of the field. The align is the alignment of the field. The alignment can be left, right, center or justify.",
    },

    only_fixtures: {
      type: "Check",
      label: "Only Fixtures",
    },
    is_child_doctype: {
      type: "Check",
      label: "Is Child Doctype",
    },
  },
  {
    label: "Doctype",
    is_system_generated: 1,
    display_field: "label",
    search_fields: "app\nname",
  }
);
