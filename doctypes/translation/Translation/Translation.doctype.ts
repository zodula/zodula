export default $doctype({
    language: {
        type: "Virtual Reference",
        label: "Language",
        reference: "Language",
        required: 1,
        is_quick_filter: 1,
        in_list_view: 1
    },
    key: {
        type: "Text",
        label: "Key",
        is_quick_filter: 1,
        required: 1,
        in_list_view: 1
    },
    translation: {
        type: "Text",
        label: "Translation",
        required: 1,
        is_quick_filter: 1,
        in_list_view: 1
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        on_delete: "CASCADE",
        required: 1,
        in_list_view: 1,
        is_quick_filter: 1
    },
    domain: {
        type: "Text",
        label: "Domain",
        required: 1,
        in_list_view: 1,
        is_quick_filter: 1
    }
}, {
    label: "Translation",
    is_system_generated: 1,
    display_field: "key"
})
