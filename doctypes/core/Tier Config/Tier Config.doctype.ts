export default $doctype<"Tier Config">({
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1,
        unique: 1,
        group: "tier_config_unique",
    },
    tier_level: {
        type: "Select",
        label: "Tier Level",
        options: "0\n1\n2\n3\n4\n5",
        required: 1,
        unique: 1,
        group: "tier_config_unique",
        default: "0"
    },
    doctype_items: {
        type: "Reference Table",
        label: "Doctype Items",
        reference: "Tier Config Doctype Item",
    }
}, {
    naming_series: "{{app}} - {{tier_level}}",
    label: "Tier Config",
    search_fields: "tier_level",
    is_global: 1,
})

