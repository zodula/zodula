export default $doctype({
    language: $f.VirtualReference({
        label: "Language",
        reference: "Language",
        required: 1
    }),
    key: {
        type: "Text",
        label: "Key",
        required: 1
    },
    translation: {
        type: "Text",
        label: "Translation",
        required: 1
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        on_delete: "CASCADE",
        required: 1
    },
    domain: {
        type: "Text",
        label: "Domain",
        required: 1
    }
}, {
    label: "Translation",
    is_system_generated: 1,
    is_global: 1
})