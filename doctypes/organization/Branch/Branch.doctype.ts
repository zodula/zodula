export default $doctype({
    name: {
        type: "Text",
        label: "Branch Name",
        required: 1,
        in_list_view: 1,
    },
    branch_code: {
        type: "Text",
        label: "Branch Code",
        in_list_view: 1,
    },
    address: {
        type: "Text",
        label: "Address",
    },
    phone: {
        type: "Text",
        label: "Phone",
    },
}, {
    label: "Branch",
    naming_series: "{{name}}",
    search_fields: "name\nbranch_code\naddress",
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Main",
            layout: [
                { type: "section", value: "Branch", align: "left" },
                [
                    { type: "field", value: "name", align: "left" },
                    { type: "field", value: "branch_code", align: "left" },
                ],
                [
                    { type: "field", value: "address", align: "left" },
                    { type: "field", value: "phone", align: "left" },
                ],
            ],
        },
    ]),
});
