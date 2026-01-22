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
    is_default: {
        type: "Check"
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
        options: "A4\nA3\nA5\nLetter\nLegal\nTabloid\nCustom",
        default: "A4",
        label: "Page Format"
    },
    custom_width: {
        type: "Float",
        label: "Custom Width (mm)",
        depends_on: "doc.format === 'Custom'",
        default: "210"
    },
    custom_height: {
        type: "Float",
        label: "Custom Height (mm)",
        depends_on: "doc.format === 'Custom'",
        default: "297"
    },
    default_lang: {
        type: "Reference",
        reference: "zodula__Language"
    },
    guided_background: {
        type: "File",
        label: "Guided Background",
        description: "Background image to guide template layout on physical paper (displayed with opacity)"
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