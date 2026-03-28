export default $doctype({
    doctype: {
        type: "Reference",
        label: "Doctype",
        reference: "Doctype",
        required: 1,
        unique: 1,
        group: "doctype-permission",
        on_delete: "CASCADE",
        is_quick_filter: 1,
    },
    role: {
        type: "Reference",
        label: "Role",
        reference: "Role",
        required: 1,
        unique: 1,
        group: "doctype-permission",
        on_delete: "CASCADE",
        in_list_view: 1,
        is_quick_filter: 1,
    },
    // Permission Level
    perm_level: {
        type: "Select",
        options: "0\n1\n2\n3\n4\n5",
        default: "0",
        label: "Permission Level",
        unique: 1,
        group: "doctype-permission",
        in_list_view: 1
    },
    can_get: {
        type: "Check",
        default: "0",
        label: "Can Get",
        required: 1,
    },
    can_update: {
        type: "Check",
        label: "Can Update",
        required: 1,
        default: "0",
    },
    can_select: {
        type: "Check",
        label: "Can Select",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_create: {
        type: "Check",
        label: "Can Create",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_delete: {
        type: "Check",
        label: "Can Delete",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_submit: {
        type: "Check",
        label: "Can Submit",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_cancel: {
        type: "Check",
        label: "Can Cancel",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_get: {
        type: "Check",
        label: "Can Own Get",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_select: {
        type: "Check",
        label: "Can Own Select",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_create: {
        type: "Check",
        label: "Can Own Create",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_update: {
        type: "Check",
        label: "Can Own Update",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_delete: {
        type: "Check",
        label: "Can Own Delete",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_submit: {
        type: "Check",
        label: "Can Own Submit",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    can_own_cancel: {
        type: "Check",
        label: "Can Own Cancel",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    },
    app: {
        type: "Reference",
        label: "App",
        reference: "App",
        required: 1,
        on_delete: "CASCADE",
        in_list_view: 1,
        is_quick_filter: 1,
    }
}, {
    label: "Doctype Permission",
    display_field: "doctype",
    tabs: JSON.stringify([
        {
            type: "Tab",
            label: "Main",
            layout: [
                { type: "section", value: "Doctype & Role", align: "left" },
                [
                    { type: "field", value: "app", align: "left" },
                    { type: "field", value: "doctype", align: "left" },
                    { type: "field", value: "role", align: "left" },
                    { type: "field", value: "perm_level", align: "left" },
                ],
                { type: "section", value: "Permissions", align: "left" },
                [
                    { type: "field", value: "can_get", align: "left" },
                    { type: "field", value: "can_select", align: "left" },
                    { type: "field", value: "can_create", align: "left" },
                    { type: "field", value: "can_update", align: "left" },
                ],
                [
                    { type: "field", value: "can_delete", align: "left" },
                    { type: "field", value: "can_submit", align: "left" },
                    { type: "field", value: "can_cancel", align: "left" },
                    { type: "empty" },
                ],
                { type: "section", value: "Own Permissions", align: "left" },
                [
                    { type: "field", value: "can_own_get", align: "left" },
                    { type: "field", value: "can_own_select", align: "left" },
                    { type: "field", value: "can_own_create", align: "left" },
                    { type: "field", value: "can_own_update", align: "left" },
                ],
                [
                    { type: "field", value: "can_own_delete", align: "left" },
                    { type: "field", value: "can_own_submit", align: "left" },
                    { type: "field", value: "can_own_cancel", align: "left" },
                    { type: "empty" },
                ],
            ],
        },
    ]),
});
