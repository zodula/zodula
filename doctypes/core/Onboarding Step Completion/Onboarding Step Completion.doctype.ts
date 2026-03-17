export default $doctype<"Onboarding Step Completion">({
    user: {
        type: "Reference",
        label: "User",
        reference: "User",
        required: 1,
        in_list_view: 1,
    },
    organization: {
        type: "Reference",
        label: "Organization",
        reference: "Organization",
        required: 1,
        in_list_view: 1,
    },
    onboarding_step_id: {
        type: "Text",
        label: "Onboarding Step ID",
        required: 1,
        in_list_view: 1,
        description: "ID of the Onboarding Step document that was completed.",
    },
    completed_at: {
        type: "Date",
        label: "Completed At",
        required: 0,
        default: "TODAY()",
        in_list_view: 1,
    },
}, {
    label: "Onboarding Step Completion",
    is_global: 1,
    search_fields: "user\norganization\nonboarding_step_id",
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Main",
            layout: [
                { type: "section", value: "Completion", align: "left" },
                [
                    { type: "field", value: "user", align: "left" },
                    { type: "field", value: "organization", align: "left" },
                    { type: "field", value: "onboarding_step_id", align: "left" },
                    { type: "field", value: "completed_at", align: "left" },
                ],
            ],
        },
    ]),
});
