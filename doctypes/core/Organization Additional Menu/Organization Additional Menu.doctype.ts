export default $doctype<"Organization Additional Menu">({
    label: {
        type: "Text",
        label: "Label",
        required: 1,
        in_list_view: 1,
    },
    url: {
        type: "Text",
        label: "URL",
        required: 1,
        in_list_view: 1,
        description: "App path (e.g. /contact, /org/track) or full URL (https://…).",
    },
}, {
    label: "Organization Additional Menu",
    is_child_doctype: 1,
});
