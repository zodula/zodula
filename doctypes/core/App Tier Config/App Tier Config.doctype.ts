export default $doctype<"App Tier Config">({
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1,
        unique: 1,
        group: "app_tier_config_unique",
    },
    package_name: {
        type: "Text",
        label: "Package Name",
    },
    description: {
        type: "Text",
        label: "Description",
    },
    enabled: {
        type: "Check",
        label: "Enabled",
        default: "1",
    },
    tier_level: {
        type: "Select",
        label: "Tier Level",
        options: "0\n1\n2\n3\n4\n5",
        required: 1,
        unique: 1,
        group: "app_tier_config_unique",
        default: "0"
    },
    currency: {
        type: "Text",
        label: "Currency",
        default: "$"
    },
    price_monthly: {
        type: "Float",
        label: "Price Monthly"
    },
    price_yearly: {
        type: "Float",
        label: "Price Yearly"
    },
    app_tier_config_doctype_items: {
        type: "Reference Table",
        label: "App Tier Config Doctype Items",
        reference: "App Tier Config Doctype Item",
    }
}, {
    naming_series: "{{app}} - {{tier_level}}",
    label: "App Tier Config",
    search_fields: "tier_level",
    is_global: 1,
})
