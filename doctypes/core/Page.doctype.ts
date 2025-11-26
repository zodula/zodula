export default $doctype({
    name: $f.Text({
        label: "Name",
        required: 1,
    }),
    href: $f.Text({
        label: "Href",
        required: 1
    })
}, {
    label: "Page",
    display_field: "name",
    search_fields: "name\nhref"
})