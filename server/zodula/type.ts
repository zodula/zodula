export interface BaseOptions {
    bypass?: boolean
    override?: boolean
}

export interface ServerSideInsertOptions extends BaseOptions {

}

export interface ServerSideSelectOptions<TN extends Zodula.DoctypeName = Zodula.DoctypeName> extends BaseOptions {
    filters?: IFilter<TN, keyof Zodula.InsertDoctype<TN>, IOperator>[]
    limit?: number
    page?: number
}

export const OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"] as const

export type IOperator = (typeof OPERATORS)[number]
export type IOperatorValue<TN extends Zodula.DoctypeName = Zodula.DoctypeName, F extends keyof Zodula.InsertDoctype<TN> = keyof Zodula.InsertDoctype<TN>, O extends IOperator = IOperator> = O extends "LIKE" | "NOT LIKE"
    ? string
    : O extends "IN" | "NOT IN"
    ? Array<Zodula.InsertDoctype<TN>[F]>
    : O extends "IS NULL" | "IS NOT NULL"
    ? 1 | 0 | "1" | "0"
    : O extends "LIKE" | "NOT LIKE"
    ? string
    : Zodula.InsertDoctype<TN>[F]

export type IFilter<TN extends Zodula.DoctypeName = Zodula.DoctypeName, F extends keyof Zodula.InsertDoctype<TN> = keyof Zodula.InsertDoctype<TN>, O extends IOperator = IOperator> = [
    F,
    O,
    IOperatorValue<TN, F, O>
]