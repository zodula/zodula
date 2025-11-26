import { ErrorWithCode } from "@/zodula/error"
import { zodula } from ".."
import { Database } from "../../database/database"
import { loader } from "../../loader"
import { ZodulaDoctypeHelper } from "./helper"
import path from "path"
import fs from "fs/promises"
import type { Bunely } from "bunely"

// Global constant for default on_delete behavior
export const DEFAULT_ON_DELETE_BEHAVIOR = "CASCADE"

export class ZodulaDoctypeDeleter<TN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    private doctypeName: TN
    private id: string
    private options = {
        bypass: false
    }

    constructor(doctypeName: TN, id: string) {
        this.doctypeName = doctypeName
        this.id = id
    }

    bypass(bypass: boolean = true) {
        this.options.bypass = bypass
        return this
    }

    private async deleteFiles(doctype: any) {
        try {
            const filesDir = path.join(process.cwd(), ".zodula_data", "files", this.doctypeName, this.id)

            // Check if the directory exists
            try {
                await fs.access(filesDir)
            } catch {
                // Directory doesn't exist, no files to delete
                return
            }

            // Get all field directories
            const fieldDirs = await fs.readdir(filesDir)

            for (const fieldDir of fieldDirs) {
                const fieldPath = path.join(filesDir, fieldDir)
                const stat = await fs.stat(fieldPath)

                if (stat.isDirectory()) {
                    // Delete all files in this field directory
                    const files = await fs.readdir(fieldPath)
                    for (const file of files) {
                        await fs.unlink(path.join(fieldPath, file))
                    }

                    // Remove the field directory
                    await fs.rmdir(fieldPath)
                }
            }

            // Remove the document directory
            await fs.rmdir(filesDir).catch(() => { })
        } catch (error) {
            // Log error but don't throw - file deletion shouldn't prevent document deletion
            console.warn(`Failed to delete files for ${this.doctypeName}/${this.id}:`, error)
        }
    }

    private async _delete() {
        const db = Database("main")
        const doctype = loader.from("doctype").get(this.doctypeName)
        const user = await zodula.session.user()
        const old = await zodula.doctype(this.doctypeName).get(this.id).bypass(true).unsafe()

        // Validate document exists
        if (!old) {
            throw new Error(`Document with id ${this.id} not found`, { cause: 404 })
        }

        const prepared = {
            ...old,
            id: this.id
        }
        const roles = await zodula.session.roles()
        const { can, userPermissionCan } = await ZodulaDoctypeHelper.checkPermission(
            this.doctypeName,
            "can_delete",
            prepared,
            {
                bypass: this.options.bypass,
                doctype,
                user,
                roles
            }
        )

        if (!can) {
            throw new ErrorWithCode("You do not have permission to delete this document", {
                status: 403
            })
        }

        if (!userPermissionCan) {
            throw new ErrorWithCode(`You do not have User Permission to delete ${this.doctypeName} document with id ${this.id}`, {
                status: 403
            })
        }
        if (prepared?.doc_status === 1) {
            throw new ErrorWithCode("You cannot delete a submitted document", {
                status: 403
            })
        }

        // Execute before delete trigger
        await loader.from("doctype").trigger(this.doctypeName, "before_delete", { old: old, doc: prepared, input: undefined })

        // Handle reference fields based on their on_delete behavior
        await this.updateReferenceFields(db, doctype, this.id)

        // Delete main document
        const result = await db.delete(doctype?.name).where("id", "=", this.id).returning("*").execute()

        // Delete associated files
        await this.deleteFiles(doctype)

        // Create audit trail for delete action
        await this.createAuditTrail(old, prepared)

        // Execute after delete trigger
        await loader.from("doctype").trigger(this.doctypeName, "after_delete", { old: old, doc: prepared, input: undefined })
        return result
    }

    private async updateReferenceFields(db: Bunely, doctype: any, targetId: string) {
        const allDoctypes = loader.from("doctype").list()
        const errors = [] as { doctype: string, field: string, error: string }[]
        for (const doctype of allDoctypes) {
            const doctypeFields = doctype.schema.fields as Record<string, Zodula.Field>
            for (const [fieldName, fieldConfig] of Object.entries(doctypeFields)) {
                const field = fieldConfig as any
                if ((field.type === "Reference") && field.reference === this.doctypeName) {
                    if (fieldName) {
                        const existings = await zodula.doctype(doctype.name).select().where(fieldName as any, "=", targetId).bypass(true)
                        for (const existing of existings.docs) {
                            const onDeleteBehavior = field.on_delete || DEFAULT_ON_DELETE_BEHAVIOR

                            switch (onDeleteBehavior) {
                                case "CASCADE":
                                    // Delete the referencing document
                                    await zodula.doctype(doctype.name).delete(existing.id).bypass(true)
                                    break

                                case "SET NULL":
                                    // Set the reference field to null
                                    await zodula.doctype(doctype.name).update(existing.id, {
                                        [fieldName]: null
                                    }).bypass(true).catch((error) => {
                                        errors.push({ doctype: doctype.name, field: fieldName, error: error.message })
                                    })
                                    break

                                case "SET DEFAULT":
                                    // Set the reference field to its default value
                                    const defaultValue = field.default || null
                                    await zodula.doctype(doctype.name).update(existing.id, {
                                        [fieldName]: defaultValue
                                    }).bypass(true).catch((error) => {
                                        errors.push({ doctype: doctype.name, field: fieldName, error: error.message })
                                    })
                                    break

                                case "NO ACTION":
                                    // Check if the field is required - if so, prevent deletion
                                    if (field.required) {
                                        throw new ErrorWithCode(
                                            `Cannot delete ${this.doctypeName} document with id ${targetId}. It is referenced by ${doctype.name} document ${existing.id} and the reference field '${fieldName}' is required.`,
                                            { status: 400 }
                                        )
                                    }
                                    // If not required, set to null
                                    await zodula.doctype(doctype.name).update(existing.id, {
                                        [fieldName]: null
                                    }).bypass(true).catch((error) => {
                                        errors.push({ doctype: doctype.name, field: fieldName, error: error.message })
                                    })
                                    break

                                default:
                                    // Default to CASCADE behavior
                                    await zodula.doctype(doctype.name).delete(existing.id).bypass(true).catch((error) => {
                                        errors.push({ doctype: doctype.name, field: fieldName, error: error.message })
                                    })
                                    break
                            }
                        }
                    }
                }
            }
        }
        if (errors.length > 0) {
            throw new ErrorWithCode(`Failed to delete reference fields: ${errors.map((error) => `${error.doctype}.${error.field}: ${error.error}`).join(", ")}`, {
                status: 400
            })
        }
    }

    private async createAuditTrail(old: Zodula.SelectDoctype<TN>, prepared: Zodula.SelectDoctype<TN>) {
        const user = await zodula.session.user()
        await ZodulaDoctypeHelper.createAuditTrail(
            this.doctypeName,
            old,
            prepared,
            "Delete",
            user.id,
            user.name || ""
        )
    }

    then(resolve: (value: any) => void, reject: (reason: any) => void) {
        return this._delete().then(resolve).catch(reject)
    }

    catch(reject: (reason: any) => void) {
        return this._delete().catch(reject)
    }
}