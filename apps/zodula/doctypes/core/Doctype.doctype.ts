export default $doctype({
    app: $f.Text({
        label: "App",
        required: 1,
        unique: 1,
        group: "group1"
    }),
    name: $f.Text({
        label: "Name",
        required: 1,
        unique: 1,
        group: "group1"
    }),
    label: $f.Text({
        label: "Label",
    }),
    json_model: $f.JSON({
        label: "JSON Model",
    }),
    is_single: $f.Check({
        label: "Is Single",
    }),
    naming_series: $f.Text({
        label: "Naming Series",
    }),
    is_submittable: $f.Check({
        label: "Is Submittable",
    }),
    track_changes: $f.Check({
        label: "Track Changes",
    }),
    display_field: $f.Text({
        label: "Display Field",
    }),
    // field1\nfield2\nfield3
    search_fields: $f.Text({
        label: "Search Fields",
    }),
    is_system_generated: $f.Check({
        label: "Is System Generated",
    }),
    require_user_permission: {
        type: "Check",
        label: "Require User Permission",
    },

    tabs: {
        type: "JSON",
        label: "Tabs",
        description: "The tabs of the doctype. The tabs are defined as an array of objects with the following properties: name, label, layout. The layout is an array of objects with the following properties: type, value, align. The type is the type of the field and the value is the value of the field. The align is the alignment of the field. The alignment can be left, right, center or justify.",
    }
}, {
    label: "Doctype",
    is_system_generated: 1,
    display_field: "label",
    search_fields: "app\nname"
})