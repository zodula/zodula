import { ErrorWithCode } from "@/zodula/error"
import { zodula } from ".."
import { Database } from "../../database/database"
import { loader } from "../../loader"
import { ZodulaDoctypeHelper } from "./helper"
import { ZodulaSession } from "../session"
import path from "path"
import fs from "fs/promises"
import type { Bunely } from "bunely"
import type { DoctypeMetadata } from "../../loader/plugins/doctype"
import { getDoctypeConnections } from "../utils"

// Global constant for default on_delete behavior
export const DEFAULT_ON_DELETE_BEHAVIOR = "CASCADE"

export class ZodulaDoctypeDeleter<TN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    private doctypeName: TN
    private id: string
    private session: ZodulaSession = new ZodulaSession()
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

            const dir = path.join(process.cwd(), ".zodula_data", "files", this.doctypeName, this.id)
            try {
                await fs.access(dir)
            } catch {
                return
            }
            await fs.rmdir(dir, { recursive: true })

        } catch (error) {
            // Log error but don't throw - file deletion shouldn't prevent document deletion
            console.warn(`Failed to delete files for ${this.doctypeName}/${this.id}:`, error)
        }
    }

    private async _delete() {
        const db = Database("main")
        const doctype = loader.from("doctype").get(this.doctypeName)
        // Use bypass=true so internal deletes (e.g. from doctype hooks) don't
        // require a real cookie-based session.
        let old = await zodula.doctype(this.doctypeName).get(this.id).bypass(true).unsafe()
        // Validate document exists
        if (!old) {
            throw new Error(`Document with id ${this.id} not found`, { cause: 404 })
        }

        const prepared = {
            ...old,
            id: this.id
        }
        const { can } = await ZodulaDoctypeHelper.checkPermission(
            this.doctypeName,
            "can_delete",
            prepared,
            {
                bypass: this.options.bypass,
                doctype,
            }
        )

        if (!can) {
            throw new ErrorWithCode(`You do not have permission to delete ${this.doctypeName} document with id ${this.id}`, {
                status: 403
            })
        }
        if (prepared?.doc_status === "Submitted") {
            throw new ErrorWithCode("You cannot delete a submitted document", {
                status: 403
            })
        }

        // Execute before delete trigger
        await loader.from("doctype").trigger(this.doctypeName, "before_delete", { old: old, doc: prepared, input: undefined })

        // When deleting any doctype other than Attachment, cascade delete all related
        // Attachment docs (and their files). This keeps orphan attachments/files from
        // accumulating after a parent doc id change/delete.
        if (this.doctypeName !== "Attachment") {
            const attachments = await zodula.doctype("Attachment").select().where("docId", "=", this.id).where("doctype", "=", this.doctypeName).bypass(true)
            for (const attachment of attachments.docs) {
                await zodula.doctype("Attachment").delete(attachment.id).bypass(true)
            }
        }

        // Handle reference fields based on their on_delete behavior
        await this.updateReferenceFields(doctype, this.id)

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

    private async updateReferenceFields(doctype: DoctypeMetadata, id: string) {
        const db = Database("main")
        // delete children documents
        const childrenMeta = doctype.children
        for (const childMeta of childrenMeta) {
            await db.delete(childMeta.childDoctype).where("parentid", "=", id).where("parentype", "=", doctype.name).where("parentfield", "=", childMeta.parentFieldName).returning("*").execute()
        }

        // check for linked documents
        const connections = await getDoctypeConnections(doctype.name, id)
        const linkedDocuments = [] as { doctype: string, id: string }[]
        for (const connection of connections) {
            let q = zodula.doctype(connection.doctype as any).select().bypass(true)
            for (const filter of connection.filters) {
                q = q.where(filter[0], filter[1] as any, filter[2])
            }
            const results = await q
            linkedDocuments.push(...results.docs.map(doc => ({ doctype: connection.doctype, id: doc.id })))
        }
        if (linkedDocuments.length > 0) {
            throw new ErrorWithCode(`The following documents are linked to this document and cannot be deleted: ${linkedDocuments.map(doc => doc.doctype).join(", ")}`, { status: 400 })
        }
    }

    private async createAuditTrail(old: Zodula.SelectDoctype<TN>, prepared: Zodula.SelectDoctype<TN>) {
        // Same rationale as _delete(): avoid requiring cookies for internal flow.
        const user = await zodula.session.user(true)
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
        return this._delete().then(resolve).catch(e => {
            console.error(e)
            reject(e)
        })
    }

    catch(reject: (reason: any) => void) {
        return this._delete().catch(reject)
    }
}