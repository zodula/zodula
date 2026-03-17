export default $doctype({
    type: {
        type: "Select",
        label: "Type",
        options: "Link - Doctype\nLink - URL\nText\nHTML\nHeader",
        in_list_view: 1
    },
    label: {
        type: "Text",
        label: "Label",
        in_list_view: 1
    },
    value: {
        type: "Text",
        label: "Value",
        in_list_view: 1
    },
    url: {
        type: "Text",
        label: "URL",
    },
    html: { type: "Code", label: "HTML", options: "html" },
    text: {
        type: "Text",
        label: "Text",
    },
    filters: { type: "Code", label: "Filters", options: "json" },
    heading_level: {
        type: "Select",
        label: "Heading Level",
        options: "1\n2\n3\n4\n5\n6",
        default: "2"
    },
    badge_variant: {
        type: "Select",
        label: "Badge Variant",
        options: "default\nsecondary\ndestructive\nwarning\nsuccess\noutline\ndraft\nsubmitted\ncancelled\npending\napproved\nrejected\nmuted\ninfo",
    },
}, {
    label: "Workspace Item",
    is_global: 1,
});
