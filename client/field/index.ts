export const standardFields = {
    organization: {
        type: "Reference",
        label: "Organization",
        reference: "zodula__Organization",
        on_delete: "CASCADE",
        allow_on_submit: 1,
        in_list_view: 1,
    },
    id: {
        type: "Text",
        label: "ID",
        unique: 1,
        default: "HEX()",
        allow_on_submit: 1
    },
    owner: {
        type: "Reference",
        label: "Owner",
        reference: "zodula__User",
        on_delete: "SET NULL",
        allow_on_submit: 1
    },
    created_at: {
        type: "Datetime",
        label: "Created At",
        required: 1,
        default: "NOW()",
        allow_on_submit: 1
    },
    updated_at: {
        type: "Datetime",
        label: "Updated At",
        required: 1,
        default: "NOW()",
        allow_on_submit: 1
    },
    created_by: {
        type: "Reference",
        reference: "zodula__User",
        on_delete: "SET NULL",
        label: "Created By",
        allow_on_submit: 1,
    },
    updated_by: {
        type: "Reference",
        reference: "zodula__User",
        on_delete: "SET NULL",
        label: "Updated By",
        allow_on_submit: 1
    },
    doc_status: {
        type: "Integer",
        required: 1,
        default: "0",
        label: "Document Status",
        allow_on_submit: 1
    },
    idx: {
        type: "Integer",
        label: "Idx",
        default: "0",
        allow_on_submit: 1
    },
    vector: {
        type: "Text",
        label: "Vector",
        default: "[]",
        allow_on_submit: 1
    }
} as const satisfies Record<string, Zodula.Field>

export class ClientFieldHelper {

    static standardFields() {
        return standardFields
    }

    static isStandardField(fieldName: string) {
        return standardFields[fieldName as keyof typeof standardFields]
    }

    static isLayoutField(field: Zodula.Field) {
        return ["Column", "Section", "Tab"].includes(field.type)
    }

    static escapeJSON(json: string) {
        return json.replaceAll('\"', '"')
    }

    /**
     * Map doctype permissions to field permissions based on field's perm_level
     * @param doctypePermissions - Array of doctype permission records
     * @param fields - Array of field records with perm_level from Field metadata
     * @param userRoles - Array of user roles
     * @returns Map of field name to permission record
     */
    static getFieldLevelPermissions(
        doctypePermissions: Zodula.SelectDoctype<"zodula__Doctype Permission">[],
        fields: Array<{ name: string; perm_level?: string | number }>,
        userRoles: string[]
    ): Map<string, Zodula.SelectDoctype<"zodula__Doctype Permission">> {
        const fieldMap = new Map<string, Zodula.SelectDoctype<"zodula__Doctype Permission">>();

        // Filter permissions for user's roles
        const userPermissions = doctypePermissions.filter((perm) =>
            userRoles.includes(perm.role)
        );

        // For each field, if it has perm_level > 0, find matching permission
        for (const field of fields) {
            if (!field.name) continue;

            const fieldPermLevel = parseInt(String(field.perm_level || 0));
            
            // Only check permissions for fields with perm_level > 0
            if (fieldPermLevel > 0) {
                // Find permission record matching this field's perm_level and user's roles
                const permission = userPermissions.find(
                    (perm) => parseInt(String(perm.perm_level || 0)) === fieldPermLevel
                );

                if (permission) {
                    fieldMap.set(field.name, permission);
                }
            }
        }

        return fieldMap;
    }

    /**
     * Check permission level permissions for a specific field
     * @param fieldPermissions - Map of field name to permission record
     * @param fieldName - The field name to check
     * @param fieldPermLevel - The perm_level from Field metadata (0 means no restriction)
     * @param isOwn - Whether the user owns the document
     * @param bypass - Whether to bypass permission checks
     * @param isSystemAdmin - Whether the user is a System Admin
     * @returns Object with canGet and canUpdate boolean flags
     */
    static checkPermLevelForField(
        fieldPermissions: Map<string, Zodula.SelectDoctype<"zodula__Doctype Permission">>,
        fieldName: string,
        fieldPermLevel: number | string | undefined,
        isOwn: boolean = false,
        bypass: boolean = false,
        isSystemAdmin: boolean = false
    ): { canGet: boolean; canUpdate: boolean } {
        // If bypass or system admin, allow all
        if (bypass || isSystemAdmin) {
            return { canGet: true, canUpdate: true };
        }

        const permLevel = parseInt(String(fieldPermLevel || 0));

        // If field has no perm_level restriction (perm_level = 0 or undefined), allow access
        if (permLevel === 0) {
            return { canGet: true, canUpdate: true };
        }

        // Field has perm_level > 0, so it requires permission check
        const permission = fieldPermissions.get(fieldName);

        // If no permission record exists for this field's perm_level, deny access (secure by default)
        if (!permission) {
            return { canGet: false, canUpdate: false };
        }

        // Check get permission
        const canGet = permission.can_get === 1;
        const canOwnGet = permission.can_own_get === 1;
        const hasGetPermission = canGet || (canOwnGet && isOwn);

        // Check update permission
        const canUpdate = permission.can_update === 1;
        const canOwnUpdate = permission.can_own_update === 1;
        const hasUpdatePermission = canUpdate || (canOwnUpdate && isOwn);

        return {
            canGet: hasGetPermission,
            canUpdate: hasUpdatePermission
        };
    }

}