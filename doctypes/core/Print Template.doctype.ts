export default $doctype<"zodula__Print Template">({
    name: {
        type: "Text",
        required: 1
    },
    doctype: {
        type: "Reference",
        reference: "zodula__Doctype",
        required: 1
    },
    is_custom: {
        type: "Check",
        default: "0"
    },
    is_default: {
        type: "Check"
    },
    html: {
        type: "Code",
        options: "html",
        depends_on: "doc.is_custom === 1"
    },
    layout: {
        type: "JSON",
        depends_on: "doc.is_custom === 0"
    },
    css: {
        type: "Code",
        options: "css",
        label: "Custom CSS"
    },
    margin_top: {
        type: "Float",
        default: "10",
        label: "Top Margin (mm)"
    },
    margin_right: {
        type: "Float",
        default: "10",
        label: "Right Margin (mm)"
    },
    margin_bottom: {
        type: "Float",
        default: "10",
        label: "Bottom Margin (mm)"
    },
    margin_left: {
        type: "Float",
        default: "10",
        label: "Left Margin (mm)"
    },
    format: {
        type: "Select",
        options: "A4\nA3\nA5\nLetter\nLegal\nTabloid",
        default: "A4",
        label: "Page Format"
    },
    default_lang: {
        type: "Reference",
        reference: "zodula__Language"
    }
}, {
    label: "Print Template",
    search_fields: "name\ndoctype",
    display_field: "name",
    naming_series: "{{doctype}}--{{name}}"
})
    .on("after_change", async ({ doc, old, input }) => {
        if (doc.is_default) {
            const { docs: other_is_defaults } = await $zodula.doctype("zodula__Print Template").select().where("doctype", "=", doc.doctype).where("is_default", "=", 1).where("id", "!=", doc.id)
            for (const other_default of other_is_defaults) {
                await $zodula.doctype("zodula__Print Template").update(other_default.id, {
                    is_default: 0
                })
            }
        }
    })