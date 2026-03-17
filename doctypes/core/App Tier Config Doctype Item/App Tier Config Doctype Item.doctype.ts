export default $doctype<"App Tier Config Doctype Item">({
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
    },
    max_doc_per_month: {
        type: "Integer",
        label: "Max Documents Per Month",
        default: "-1",
        required: 1,
        description: "Maximum number of documents allowed per month. Set to -1 for unlimited."
    },
    max_doc_per_day: {
        type: "Integer",
        label: "Max Documents Per Day",
        default: "-1",
        required: 1,
        description: "Maximum number of documents allowed per day. Set to -1 for unlimited."
    }
}, {
    label: "App Tier Config Doctype Item",
    search_fields: "doctype",
    display_field: "doctype",
    is_child_doctype: 1,
})

