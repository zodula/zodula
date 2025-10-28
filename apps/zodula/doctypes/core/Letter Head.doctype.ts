export default $doctype<"zodula__Letter Head">({
    name: {
        type: "Text",
        required: 1
    },
    content: {
        type: "Code",
        options: "html",
        label: "Letter Head Content",
        description: "HTML content for the letter head. Use {{company_name}}, {{company_address}}, etc. for dynamic content."
    },
    is_default: {
        type: "Check",
        label: "Is Default"
    },
    disabled: {
        type: "Check",
        label: "Disabled"
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
                await $zodula.doctype("zodula__Letter Head").update(other_default.id, {
                    is_default: 0
                })
            }
        }
    })
