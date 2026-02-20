export default $doctype<"Tier Config Doctype Item">({
    tier_config: {
        type: "Reference",
        label: "Tier Config",
        reference: "Tier Config",
        required: 1
    },
    doctype: {
        type: "Reference",
        label: "Doctype",
        reference: "Doctype",
        required: 1
    },
    max_doc: {
        type: "Integer",
        label: "Max Documents",
        required: 1,
        default: "-1",
        description: "Maximum number of documents allowed for this doctype at this tier level. Set to -1 for unlimited."
    }
}, {
    label: "Tier Config Doctype Item",
    search_fields: "doctype",
    display_field: "doctype",
    is_child_doctype: 1,
})

