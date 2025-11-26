export default $doctype({
    currency_code: {
        type: "Text",
        label: "Currency Code",
        required: 1,
        unique: 1,
        in_list_view: 1
    },
    currency_name: {
        type: "Text",
        label: "Currency Name",
        required: 1,
        in_list_view: 1
    },
    symbol: {
        type: "Text",
        label: "Symbol",
        required: 1
    },
    precision: {
        type: "Integer",
        label: "Precision",
        default: "2"
    },
    is_default: {
        type: "Check",
        label: "Is Default"
    }
}, {
    label: "Currency",
    naming_series: "{{currency_code}}",
    search_fields: "currency_code\ncurrency_name",
    tabs: JSON.stringify([
        {
            type: "Tab", 
            label: "Main", 
            layout: [
                { type: "section", value: "Currency Information", align: "left" },
                [
                    { type: "field", value: "currency_code", align: "left" },
                    { type: "field", value: "currency_name", align: "left" },
                    { type: "field", value: "symbol", align: "left" }
                ],
                { type: "section", value: "Settings", align: "left" },
                [
                    { type: "field", value: "precision", align: "left" },
                    { type: "field", value: "is_default", align: "left" }
                ]
            ]
        }
    ])
})
