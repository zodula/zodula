import { format, isValid, parse } from "date-fns"
import type { FieldType } from "../../field/type"
import { zodula } from ".."
import { Database } from "../../database/database"
import type { DoctypeRelative } from "../../loader/plugins/doctype"
import { loader } from "../../loader"
import { parseDate } from "@/zodula/client/utils"
import { ErrorWithCode } from "@/zodula/error"
import { ClientFieldHelper } from "@/zodula/client/field"

export interface GETOptions<TN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    fields: (keyof Zodula.SelectDoctype<TN>)[],
    bypass: boolean,
    override: boolean,
    unsafe: boolean
}

export class ZodulaDoctypeHelper {

    static reservedValues = ["TODAY()", "NOW()", "UUID()", "TIME()"]

    static returnFields(fields: (any | "*")[], data: Zodula.SelectDoctype<any>) {
        let result = {} as Record<string, any>
        for (const field of fields) {
            if (field === "*") {
                result = data
            } else {
                result[field] = data[field]
            }
        }
        return result
    }

    static formatValue(value: string): any {
        switch (value) {
            case "TODAY()":
                return format(new Date(), "yyyy-MM-dd")
            case "NOW()":
                return format(new Date(), "yyyy-MM-dd HH:mm:ss")
            case "TIME()":
                return format(new Date(), "HH:mm:ss")
            case "UUID()":
                return Bun.randomUUIDv7()
            case "HEX()":
                return Bun.randomUUIDv7().replace(/-/g, "").slice(0, 16)
            default:
                return value
        }
    }

    static async ensureReferenceDoc<TN extends Zodula.DoctypeName>(doctype: Zodula.DoctypeSchema, doc: Zodula.SelectDoctype<TN>) {
        for (const [fieldName, field] of Object.entries(doctype.fields)) {
            if (field.type === "Reference" && field.reference === doc[fieldName as keyof Zodula.SelectDoctype<TN>]) {
                const referenceDoc = await zodula.doctype(field.reference as Zodula.DoctypeName).get(doc[fieldName as keyof Zodula.SelectDoctype<TN>] as string).bypass(true)
                if (referenceDoc) {
                    (doc as any)[fieldName] = referenceDoc.id
                } else {
                    throw new ErrorWithCode(`Foreign Key Reference ${field.reference} with value: ${doc[fieldName as keyof Zodula.SelectDoctype<TN>]} not found`, {
                        status: 400,
                    })
                }
            }
        }
        return doc
    }

    static formatDoc<TN extends Zodula.DoctypeName>(doc: Zodula.SelectDoctype<TN>, doctype: Zodula.DoctypeSchema) {
        // set default values
        const fields = doctype.fields

        for (const [fieldName] of Object.entries(fields)) {
            const config = fields[fieldName as keyof typeof fields]
            if (!config) continue
            let value = doc[fieldName as keyof typeof doc] as any

            if (config.default !== undefined && (value === undefined || value === null) && !config.plain) {
                value = ZodulaDoctypeHelper.formatValue(config.default as string)
            }

            // id cannot contain "/" or any special characters
            if (fieldName === "id" && (value?.includes("/"))) {
                throw new ErrorWithCode(`ID cannot contain "/" or any special characters`, {
                    status: 400,
                })
            }
            // id cannot start with "-"
            if (fieldName === "id" && value?.startsWith("-")) {
                throw new ErrorWithCode(`ID cannot start with "-"`, {
                    status: 400,
                })
            }

            // if input can parse to Date
            if (["Date", "Datetime", "Time"].includes(config.type as any)) {
                const fieldType = config.type
                if (value === "NOW()") {
                    value = format(new Date(), "yyyy-MM-dd HH:mm:ss")
                } else if (value === "TODAY()") {
                    value = format(new Date(), "yyyy-MM-dd")
                }
                let dateValue = new Date(value)
                if (!isValid(dateValue)) {
                    const parsedDate = parseDate(value, new Date())
                    if (parsedDate) {
                        dateValue = parsedDate
                    }
                }
                switch (fieldType) {
                    case "Date":
                        value = format(dateValue, "yyyy-MM-dd")
                        break
                    case "Datetime":
                        value = format(dateValue, "yyyy-MM-dd HH:mm:ss")
                        break
                    case "Time":
                        value = format(dateValue, "HH:mm:ss")
                        break
                    default:
                        break
                }
                if (!isValid(dateValue)) {
                    throw new Error(`Field ${fieldName} is not a valid date`)
                }
            }

            // is required
            if (config.required && (value === undefined || value === null || value === "")) {
                throw new ErrorWithCode(`Field ${fieldName} in ${doctype.name} is required`, {
                    status: 400,
                })
            }

            (doc as any)[fieldName] = value
        }

        return doc as Zodula.SelectDoctype<TN>
    }

    static prepareDoc<TN extends Zodula.DoctypeName>(doc: Zodula.SelectDoctype<TN>, doctype: Zodula.DoctypeSchema) {

    }

    static formatDocResult<TN extends Zodula.DoctypeName>(result: Zodula.SelectDoctype<TN>, doctype: Zodula.DoctypeSchema) {
        if (!result) return result
        // if field is password, set it to empty string
        for (const [fieldName, fieldValue] of Object.entries(result)) {
            const config = doctype.fields[fieldName as keyof typeof doctype.fields]
            if (!config) continue
            if (config.type === "Password" as FieldType) {
                (result as any)[fieldName] = "****"
            }
        }
        return result
    }

    static canUserPermission<DN extends Zodula.DoctypeName>(doctypeName: DN, data: Zodula.SelectDoctype<DN>, options: {
        requireUserPermission: boolean
        fields: Record<keyof Zodula.SelectDoctype<DN>, Zodula.Field>
        bypass: boolean
        userPermissions: Zodula.SelectDoctype<"zodula__User Permission">[],
        isSystemAdmin: boolean
    }) {
        const { fields, bypass, userPermissions, isSystemAdmin, requireUserPermission } = options
        if (bypass) {
            return true
        }
        if (isSystemAdmin) {
            return true
        }

        const fieldChecks = [] as boolean[]
        for (const userPermisison of userPermissions) {
            const { allow, value, apply_to_all, apply_to_only } = userPermisison as Zodula.SelectDoctype<"zodula__User Permission">
            const isApplied = apply_to_all === 1 || (apply_to_only === doctypeName)
            if (isApplied) {
                for (const [fieldName, field] of Object.entries(fields)) {
                    if (field.type === "Reference" && field.reference === allow) {
                        if (value !== data[fieldName as keyof Zodula.SelectDoctype<DN>]) {
                            fieldChecks.push(false)
                        } else {
                            fieldChecks.push(true)
                        }
                    }
                }
            }
        }
        let fieldCheck = fieldChecks.every((check) => check)
        if (fieldChecks.filter((check) => check).length === 0) {
            if (requireUserPermission) {
                fieldCheck = false
            }
        }


        let parentChecks = [] as boolean[]
        for (const userPermisison of userPermissions) {
            const { allow, value } = userPermisison as Zodula.SelectDoctype<"zodula__User Permission">
            if (allow === doctypeName) {
                if (value !== data.id) {
                    parentChecks.push(false)
                } else {
                    parentChecks.push(true)
                }
            }
        }
        let parentCheck = parentChecks.every((check) => check)
        if (parentChecks.filter((check) => check).length === 0) {
            if (requireUserPermission) {
                parentCheck = false
            }
        }

        return fieldCheck && parentCheck
    }

    static formatSqlError(error: string): string {
        // NOT NULL constraint
        const notNullMatch = error.match(/NOT NULL constraint failed: ([\w_]+)\.(\w+)/i);
        if (notNullMatch) {
            const [, table, column] = notNullMatch;
            return `Column "${column}" in table "${table}" cannot be empty.`;
        }

        // UNIQUE constraint
        const uniqueMatch = error.match(/UNIQUE constraint failed: ([\w_.]+)/i);
        if (uniqueMatch) {
            const [, full] = uniqueMatch;
            const parts = full?.split(".") || [];
            if (parts.length === 2) {
                return `Column "${parts[1]}" in table "${parts[0]}" must be unique.`;
            }
            return `Duplicate value violates UNIQUE constraint on "${full}".`;
        }

        // FOREIGN KEY constraint
        if (/FOREIGN KEY constraint failed/i.test(error)) {
            return "Foreign key constraint failed. The referenced doc does not exist." + error;
        }

        // Default fallback
        return error.replace(/^SQLITE_CONSTRAINT:\s*/i, "");
    }

    static async getPermissions(doctype: Zodula.DoctypeName, roles: string[]) {
        const db = Database("main")
        const permissions = await db.select("*").from("zodula__Doctype Permission" as Zodula.DoctypeName).where("doctype", "=", doctype).where("role", "IN", roles).execute()
        return permissions
    }

    static async getUserPermissions(userId: string) {
        const db = Database("main")
        const permissions = await db.select("*").from("zodula__User Permission" as Zodula.DoctypeName).where("user", "=", userId).execute()
        return permissions
    }

    static async can(doctype: Zodula.DoctypeName, action: keyof Zodula.SelectDoctype<"zodula__Doctype Permission">, isOwn: boolean, roles: string[], bypass: boolean) {
        const db = Database("main")
        const isAuthenticated = await zodula.session.isAuthenticated()
        const _roles = [
            ...roles,
            "Anonymous",
            isAuthenticated ? "Authenticated" : undefined,
        ].filter(Boolean)
        if (roles.includes("System Admin") || bypass) {
            return true
        }
        const permissions = await db.select("*").from("zodula__Doctype Permission" as Zodula.DoctypeName).where("doctype", "=", doctype).where("role", "IN", _roles).execute()
        const permission = permissions[0]
        if (!permission) {
            return false
        }
        const { can_create, can_get, can_select, can_update, can_delete, can_submit, can_cancel } = permission as Zodula.SelectDoctype<"zodula__Doctype Permission">
        const { can_own_create, can_own_get, can_own_select, can_own_update, can_own_delete, can_own_submit, can_own_cancel } = permission as Zodula.SelectDoctype<"zodula__Doctype Permission">
        if (action === "can_create") {
            return can_create === 1 || (can_own_create === 1 && isOwn)
        }
        if (action === "can_get") {
            return can_get === 1 || (can_own_get === 1 && isOwn)
        }
        if (action === "can_select") {
            return can_select === 1 || (can_own_select === 1 && isOwn)
        }
        if (action === "can_update") {
            return can_update === 1 || (can_own_update === 1 && isOwn)
        }
        if (action === "can_delete") {
            return can_delete === 1 || (can_own_delete === 1 && isOwn)
        }
        if (action === "can_submit") {
            return can_submit === 1 || (can_own_submit === 1 && isOwn)
        }
        if (action === "can_cancel") {
            return can_cancel === 1 || (can_own_cancel === 1 && isOwn)
        }
        return false
    }

    static async checkPermission<TN extends Zodula.DoctypeName>(
        doctypeName: TN,
        action: keyof Zodula.SelectDoctype<"zodula__Doctype Permission">,
        data: Zodula.SelectDoctype<TN>,
        options: {
            bypass: boolean
            doctype: any
            user: any
            roles: string[]
        }
    ): Promise<{ can: boolean; userPermissionCan: boolean }> {
        const { bypass, doctype, user, roles } = options

        // Check basic permissions
        const can = await ZodulaDoctypeHelper.can(doctypeName, action, data?.owner === user.id, roles, bypass)

        // Check user permissions
        const userPermissions = await ZodulaDoctypeHelper.getUserPermissions(user.id)

        const userPermissionCan = ZodulaDoctypeHelper.canUserPermission(doctypeName, data, {
            requireUserPermission: doctype?.config?.require_user_permission === 1,
            fields: doctype?.schema?.fields as Record<keyof Zodula.SelectDoctype<TN>, Zodula.Field>,
            bypass: bypass,
            userPermissions: userPermissions,
            isSystemAdmin: roles.includes("System Admin")
        })

        return { can, userPermissionCan }
    }

    static async getRelativeRecords<TN extends Zodula.DoctypeName = Zodula.DoctypeName>(id: string, relative: DoctypeRelative, options: GETOptions<TN>) {
        const db = Database("main")
        const ids = await db.all(`SELECT id FROM "${relative.childDoctype}" WHERE "${relative.childFieldName}" = '${id}' ORDER BY "idx" ASC`) as any[]
        const records = await Promise.all(ids.map(async (doc) => {
            return await zodula.doctype(relative.childDoctype).get(doc?.id as string).bypass(options.bypass)
        }))
        if (relative.type === "One to One") {
            return options.unsafe ? records[0] : ZodulaDoctypeHelper.formatDocResult(records[0] as Zodula.SelectDoctype<TN>, loader.from("doctype").get(relative.childDoctype).schema)
        }
        return options.unsafe ? records : records.map(record => ZodulaDoctypeHelper.formatDocResult(record, loader.from("doctype").get(relative.childDoctype).schema))
    }

    static validateDoc<TN extends Zodula.DoctypeName>(
        input: Zodula.InsertDoctype<TN> | Zodula.UpdateDoctype<TN>,
        doctype: Zodula.DoctypeSchema,
        bypass: boolean = false
    ): void {
        if (bypass) return

        // const readonlyFields: string[] = []

        // // Check each field in the input against the doctype schema
        // for (const [fieldName, value] of Object.entries(input)) {
        //     const fieldConfig = doctype.fields[fieldName as keyof typeof doctype.fields]
        //     if (!fieldConfig) continue

        //     const defaultValue = ZodulaDoctypeHelper.formatValue(fieldConfig.default as string)

        //     // Check if field is readonly and has a value in input
        //     if (fieldConfig.readonly && value !== undefined && value !== null && value !== defaultValue) {
        //         readonlyFields.push(fieldName)
        //     }
        // }

        // if (readonlyFields.length > 0) {
        //     throw new ErrorWithCode(`Cannot modify readonly fields: ${readonlyFields.join(", ")}`, {
        //         status: 400,
        //     })
        // }

        // check for required
        for (const [fieldName, value] of Object.entries(input)) {
            const fieldConfig = doctype.fields[fieldName as keyof typeof doctype.fields]
            if (!fieldConfig) continue
            if (fieldConfig.required && (value === undefined || value === null || value === "")) {
                throw new ErrorWithCode(`Field ${fieldName} is required`, {
                    status: 400,
                })
            }
        }
    }

    static async createAuditTrail<TN extends Zodula.DoctypeName>(
        doctypeName: TN,
        old: Zodula.SelectDoctype<TN>,
        result: Zodula.SelectDoctype<TN>,
        action: "Update" | "Submit" | "Cancel" | "Delete" | "Rename",
        userId: string,
        userName: string
    ): Promise<void> {
        try {
            const ctx = zodula.ctx
            if (!ctx) {
                return
            }
            const doctype = loader.from("doctype").get(doctypeName)
            if (!doctype.config.track_changes) {
                return
            }

            // Get user-defined fields (exclude system fields)
            const systemFields = Object.keys(ClientFieldHelper.standardFields())
            const userDefinedFields = Object.keys(doctype.schema.fields).filter(field => !systemFields.includes(field))

            // Check if any user-defined fields have changed
            const changedFields: string[] = []
            const oldValues: Record<string, any> = {}
            const newValues: Record<string, any> = {}

            // For rename action, always include the ID change
            if (action === "Rename" && old.id !== result.id) {
                changedFields.push("id")
                oldValues.id = old.id
                newValues.id = result.id
            }

            for (const field of userDefinedFields) {
                const oldValue = old[field as keyof Zodula.SelectDoctype<TN>]
                const newValue = result[field as keyof Zodula.SelectDoctype<TN>]

                // Compare values (handle null/undefined cases)
                const oldVal = oldValue === null || oldValue === undefined ? null : oldValue
                const newVal = newValue === null || newValue === undefined ? null : newValue

                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    changedFields.push(field)
                    oldValues[field] = oldVal
                    newValues[field] = newVal
                }
            }

            // Create audit trail data
            const auditTrailData = {
                doctype: doctypeName,
                doctype_id: result.id,
                action: action,
                old_value: JSON.stringify(changedFields.length > 0 ? oldValues : { doc_status: old.doc_status }),
                new_value: JSON.stringify(changedFields.length > 0 ? newValues : { doc_status: result.doc_status }),
                by_name: userName
            }

            // Insert audit trail record
            await zodula.doctype("zodula__Audit Trail").insert(auditTrailData).bypass(true)
        } catch (error) {
            // Log error but don't fail the operation
            console.error("Failed to create audit trail:", error)
        }
    }

    static detectVectorFields<TN extends Zodula.DoctypeName>(
        doctype: Zodula.DoctypeSchema,
        data: Zodula.SelectDoctype<TN>
    ): Array<{ fieldName: string; value: string }> {
        const vectorFields: Array<{ fieldName: string; value: string }> = []

        for (const [fieldName, fieldConfig] of Object.entries(doctype.fields)) {
            const config = fieldConfig as any

            if (config?.type === "Vector") {
                const value = data[fieldName as keyof Zodula.SelectDoctype<TN>] as string
                if (value && typeof value === "string" && value.trim() !== "") {
                    vectorFields.push({
                        fieldName,
                        value: value.trim()
                    })
                }
            }
        }

        return vectorFields
    }

    static detectVectorFieldChanges<TN extends Zodula.DoctypeName>(
        doctype: Zodula.DoctypeSchema,
        old: Zodula.SelectDoctype<TN>,
        prepared: Zodula.SelectDoctype<TN>
    ): Array<{ fieldName: string; oldValue: string; newValue: string }> {
        const changedVectorFields: Array<{ fieldName: string; oldValue: string; newValue: string }> = []

        for (const [fieldName, fieldConfig] of Object.entries(doctype.fields)) {
            const config = fieldConfig as any

            if (config?.type === "Vector") {
                const oldValue = old[fieldName as keyof Zodula.SelectDoctype<TN>] as string
                const newValue = prepared[fieldName as keyof Zodula.SelectDoctype<TN>] as string

                // Compare values (handle null/undefined cases)
                const oldVal = oldValue === null || oldValue === undefined ? "" : oldValue
                const newVal = newValue === null || newValue === undefined ? "" : newValue

                if (oldVal !== newVal) {
                    changedVectorFields.push({
                        fieldName,
                        oldValue: oldVal,
                        newValue: newVal
                    })
                }
            }
        }

        return changedVectorFields
    }

    static formatVectorData<TN extends Zodula.DoctypeName>(
        docId: string,
        vectorFields: Array<{ fieldName: string; value: string }>
    ): string {
        if (vectorFields.length === 0) {
            return ""
        }

        const fieldData = vectorFields
            .map(field => `${field.fieldName}: ${field.value}`)
            .join('\n')

        return `id: ${docId}\n${fieldData}`
    }

    // TODO: Implement embeddings processing
    // This method should:
    // 1. Accept vector data string and configuration options
    // 2. Generate embeddings using the specified model (OpenAI, Hugging Face, etc.)
    // 3. Return the embedding vectors for each field
    // 4. Handle errors gracefully
    // 5. Support different embedding models and dimensions
    // 6. Cache embeddings to avoid regeneration
    static async processVectorEmbeddings(
        vectorData: string,
        options?: {
            model?: string
            dimensions?: number
            batchSize?: number
        }
    ): Promise<Record<string, number[]>> {
        // TODO: Implement actual embeddings processing
        // Example implementation structure:
        // const model = options?.model || 'text-embedding-ada-002'
        // const dimensions = options?.dimensions || 1536
        // const embeddings = await generateEmbeddings(vectorData, { model, dimensions })
        // return embeddings

        console.log(`TODO: Process embeddings for vector data:`, vectorData)
        console.log(`TODO: Options:`, options)

        // Placeholder return - replace with actual embedding generation
        return {}
    }
}