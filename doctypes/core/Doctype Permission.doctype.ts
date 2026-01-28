export default $doctype({
    doctype: {
        type: "Reference",
        label: "Doctype",
        reference: "zodula__Doctype",
        required: 1,
        unique: 1,
        group: "doctype-permission",
        on_delete: "CASCADE",
    },
    role: {
        type: "Reference",
        label: "Role",
        reference: "zodula__Role",
        required: 1,
        unique: 1,
        group: "doctype-permission",
        on_delete: "CASCADE"
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
    can_get: $f.Check({
        default: "0",
        label: "Can Get",
        required: 1,
    }),
    can_update: $f.Check({
        label: "Can Update",
        required: 1,
        default: "0",
    }),
    can_select: $f.Check({
        label: "Can Select",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_create: $f.Check({
        label: "Can Create",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_delete: $f.Check({
        label: "Can Delete",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_submit: $f.Check({
        label: "Can Submit",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_cancel: $f.Check({
        label: "Can Cancel",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_get: $f.Check({
        label: "Can Own Get",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_select: $f.Check({
        label: "Can Own Select",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_create: $f.Check({
        label: "Can Own Create",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_update: $f.Check({
        label: "Can Own Update",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_delete: $f.Check({
        label: "Can Own Delete",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_submit: $f.Check({
        label: "Can Own Submit",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
    can_own_cancel: $f.Check({
        label: "Can Own Cancel",
        required: 1,
        default: "0",
        depends_on: "doc.perm_level == 0"
    }),
}, {
    label: "Doctype Permission",
    is_global: 1,
    display_field: "doctype"
}); 