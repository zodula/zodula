export class ErrorWithCode {
    public code: string
    public status: number
    constructor(public message: string, options: {
        code?: string
        status?: number
    }) {
        this.code = options.code || ""
        this.status = options.status || 500
    }
}