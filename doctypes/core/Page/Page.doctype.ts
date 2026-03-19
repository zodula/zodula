export default $doctype({
    name: {
        type: "Text",
        label: "Name",
        required: 1,
    },
    href: {
        type: "Text",
        label: "Href",
        required: 1
    }
}, {
    label: "Page",
    display_field: "name",
    search_fields: "name\nhref",
})
