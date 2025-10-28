import { ZodulaSession } from "../session"
import { ZodulaDoctypeSelector } from "./select"
import { ZodulaDoctypeInsert } from "./insert"
import { ZodulaDoctypeUpdate } from "./update"
import { ZodulaDoctypeGetter } from "./get"
import { ZodulaDoctypeDeleter } from "./delete"
import { ZodulaDoctypeSubmit } from "./submit"
import { ZodulaDoctypeCancel } from "./cancel"
import { ZodulaDoctypeRename } from "./rename"
import { ErrorWithCode } from "@/zodula/error"
import path from "path"

export class ZodulaDoctype<TN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    private doctypeName: TN

    constructor(doctypeName: TN) {
        this.doctypeName = doctypeName
    }

    // Main Methods
    insert(input: Zodula.InsertDoctype<TN>) {
        return new ZodulaDoctypeInsert<TN>(this.doctypeName, input)
    }

    select() {
        return new ZodulaDoctypeSelector<TN>(this.doctypeName)
    }

    update(id: string, input: Zodula.UpdateDoctype<TN>) {
        return new ZodulaDoctypeUpdate<TN>(this.doctypeName, id, input)
    }

    get(id: string) {
        return new ZodulaDoctypeGetter<TN>(this.doctypeName, id)
    }

    delete(id: string) {
        return new ZodulaDoctypeDeleter<TN>(this.doctypeName, id)
    }

    submit(id: string) {
        return new ZodulaDoctypeSubmit<TN>(this.doctypeName, id)
    }

    cancel(id: string) {
        return new ZodulaDoctypeCancel<TN>(this.doctypeName, id)
    }

    rename(oldId: string, newId: string) {
        return new ZodulaDoctypeRename<TN>(this.doctypeName, oldId, newId)
    }

    async get_file_url(docId: string, fieldName: string) {
        const doc = await this.get(docId).fields((["*"]) as any[])
        if (!doc) {
            throw new ErrorWithCode(`Document ${docId} not found`, {
                status: 404
            })
        }
        const file = doc?.[fieldName as keyof typeof doc];
        if (!file) {
            throw new ErrorWithCode(`File ${fieldName} not found`, {
                status: 404
            })
        }
        const file_path = path.join(process.cwd(), ".zodula_data", "files", this.doctypeName, docId, fieldName, file as string)
        return file_path
    }
}