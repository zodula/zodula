import type { AxiosInstance } from "axios"
import type { IFilter, IOperator } from "../../server/zodula/type"

interface SelectDocsOptions<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    fields?: string[]
    limit: number
    sort: string
    order: string
    filters?: IFilter<DN, keyof Zodula.InsertDoctype<DN>, IOperator>[]
    q?: string
}

interface SelectDocsResponse<DN extends Zodula.DoctypeName = Zodula.DoctypeName> {
    docs: Zodula.SelectDoctype<DN>[]
    limit: number
    page: number
    count: number
}

interface GetDocOptions {
    fields?: string[]
}

export class ZodulaDoc {
    constructor(private api: AxiosInstance) {
    }

    select_docs = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, options: SelectDocsOptions<DN>) => {
        const response = await this.api.get(`/api/resources/${doctype}`, {
            params: {
                ...options
            }
        })
        return response.data as SelectDocsResponse<DN>
    }

    get_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, id?: string, options?: GetDocOptions) => {
        const response = await this.api.get(`/api/resources/${doctype}${id ? `/${id}` : ""}`, {
            params: options
        })
        return response.data as Zodula.SelectDoctype<DN>
    }

    create_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, input: Zodula.InsertDoctype<DN>) => {
        const response = await this.api.post(`/api/resources/${doctype}/new`, input, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        })
        return response.data as Zodula.SelectDoctype<DN>
    }

    create_docs = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, inputs: Zodula.InsertDoctype<DN>[]) => {
        const response = await this.api.post(`/api/resources/${doctype}`, {
            docs: inputs
        }, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        })
        return response.data as Zodula.SelectDoctype<DN>[]
    }

    update_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, id: string, input: Zodula.UpdateDoctype<DN>) => {
        const response = await this.api.put(`/api/resources/${doctype}${id ? `/${id}` : ""}`, input, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        })
        return response.data as Zodula.SelectDoctype<DN>
    }

    delete_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, id: string) => {
        const response = await this.api.delete(`/api/resources/${doctype}${id ? `/${id}` : ""}`)
        return response.data as Zodula.SelectDoctype<DN>
    }

    delete_docs = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, ids: string[]) => {
        const response = await this.api.delete(`/api/resources/${doctype}`, {
            data: {
                ids: ids
            }
        })
        return response.data as Zodula.SelectDoctype<DN>
    }

    submit_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, id: string) => {
        const response = await this.api.post(`/api/action/zodula.doc.submit`, {
            doctype,
            id
        })
        return response.data as Zodula.SelectDoctype<DN>
    }

    cancel_doc = async <DN extends Zodula.DoctypeName = Zodula.DoctypeName>(doctype: DN, id: string) => {
        const response = await this.api.post(`/api/action/zodula.doc.cancel`, {
            doctype,
            id
        })
        return response.data as Zodula.SelectDoctype<DN>
    }
}