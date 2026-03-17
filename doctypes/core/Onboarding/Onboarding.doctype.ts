export default $doctype<"Onboarding">({
    name: {
        type: "Text",
        label: "Name",
        required: 1,
        in_list_view: 1,
    },
    mode: {
        type: "Select",
        label: "Mode",
        options: "Organization Owner\nOrganization User",
        required: 1,
        default: "Organization Owner",
        in_list_view: 1,
        description: "Organization Owner: steps for org owners only. Organization User: steps filtered by role.",
    },
    onboarding_steps: {
        type: "Reference Table",
        label: "Onboarding Steps",
        reference: "Onboarding Step",
        required: 0,
    },
}, {
    label: "Onboarding",
    naming_series: "{{name}}",
    is_global: 1,
    search_fields: "name",
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Main",
            layout: [
                { type: "section", value: "Details", align: "left" },
                [
                    { type: "field", value: "name", align: "left" },
                    { type: "field", value: "mode", align: "left" },
                ],
                { type: "section", value: "Steps", align: "left" },
                [
                    { type: "field", value: "onboarding_steps", align: "left" },
                ],
            ],
        },
    ]),
});
