export default $doctype<"Onboarding Step">({
    title: {
        type: "Text",
        label: "Title",
        required: 1,
        in_list_view: 1,
    },
    description: {
        type: "Text",
        label: "Description",
        required: 0,
        in_list_view: 1,
    },
    target_selector: {
        type: "Text",
        label: "Target Selector",
        required: 0,
        description: "Optional CSS selector to spotlight an element during the tour (e.g. #org-currency, .primary-action).",
    },
    route: {
        type: "Text",
        label: "Route",
        required: 0,
        description: "Route or path to open when user clicks the step (e.g. /desk/Org/doctypes/Organization/Sheet).",
    },
    roles: {
        type: "Text",
        label: "Roles",
        required: 0,
        description: "Comma-separated role names. For Organization User mode only; empty means step is shown to all org users.",
    },
    completion_mode: {
        type: "Text",
        label: "Completion Mode",
        required: 0,
        description:
            "How this step is completed. Leave empty for manual (Next button). Supported values: auto_on_click (mark done when target is clicked), auto_on_path (mark done when pathname matches completion_value, use {{org}} for org slug), require_value (show Next only when target field has a value).",
    },
    completion_value: {
        type: "Text",
        label: "Completion Value",
        required: 0,
        description:
            "Regex pattern. Empty = any text/path. For require_value: field value must match (regex). For auto_on_path: pathname must match (regex; use {{org}} for org slug).",
    },
}, {
    label: "Onboarding Step",
    is_child_doctype: 1,
    search_fields: "title\ndescription\nroute",
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Main",
            layout: [
                { type: "section", value: "Step", align: "left" },
                [
                    { type: "field", value: "title", align: "left" },
                    { type: "field", value: "description", align: "left" },
                    { type: "field", value: "target_selector", align: "left" },
                    { type: "field", value: "route", align: "left" },
                    { type: "field", value: "roles", align: "left" },
                    { type: "field", value: "completion_mode", align: "left" },
                    { type: "field", value: "completion_value", align: "left" },
                    { type: "field", value: "idx", align: "left" },
                ],
            ],
        },
    ]),
});
