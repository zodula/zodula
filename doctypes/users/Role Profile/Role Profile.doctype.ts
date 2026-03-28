export default $doctype<"Role Profile">({
    name: {
        type: "Data",
        label: "Name",
        required: 1,
        unique: 1,
        in_list_view: 1,
    },
    roles: {
        type: "Reference Table",
        label: "Roles",
        reference: "Role Profile Role",
        required: 0,
    },
}, {
    label: "Role Profile",
    display_field: "name",
    search_fields: "name",
    naming_series: "{{name}}",
});
