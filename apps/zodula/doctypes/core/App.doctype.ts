export default $doctype({
    name: $f.Text({
        label: "Name",
        required: 1,
        unique: 1
    }),
    description: $f.Text({
        label: "Description"
    }),
    version: $f.Text({
        label: "Version",
        required: 1
    })
}, {
    label: "App",
    is_system_generated: 1,
    naming_series: "{{name}}"
});