export default $doctype<"zodula__Letter Head">({
    name: {
        type: "Text",
        required: 1
    },
    is_default: {
        type: "Check",
        label: "Is Default"
    },
    disabled: {
        type: "Check",
        label: "Disabled"
    },
    format: {
        type: "Select",
        options: "A4\nA3\nA5\nLetter\nLegal\nTabloid\n210x30mm\n30x30mm\nCustom",
        default: "A4",
        label: "Page Format"
    },
    align: {
        type: "Select",
        options: "left\nmiddle\nright",
        default: "left",
        label: "Alignment",
        description: "Horizontal alignment when used with Print Template"
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
    guided_background: {
        type: "File",
        label: "Guided Background",
        description: "Background image to guide template layout on physical paper (displayed with opacity)"
    },
    items: {
        type: "Reference Table",
        label: "Items",
        reference: "zodula__Letter Head Item",
        required: 0
    }
}, {
    label: "Letter Head",
    search_fields: "name",
    display_field: "name",
    naming_series: "LH-{{name}}"
})
    .on("after_change", async ({ doc, old, input }) => {
        if (doc.is_default) {
            const { docs: other_is_defaults } = await $zodula.doctype("zodula__Letter Head").select().where("is_default", "=", 1).where("id", "!=", doc.id)
            for (const other_default of other_is_defaults) {
                console.log("other_default", other_default)
                await $zodula.doctype("zodula__Letter Head").update(other_default.id, {
                    is_default: 0
                })
            }
        }
    })
