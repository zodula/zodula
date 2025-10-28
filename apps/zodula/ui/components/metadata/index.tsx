import type { Context } from "bxo"

export interface Metadata {
    title?: string
    description?: string
    links?: {
        rel: string
        href: string
        [key: string]: any
    }[]
    scripts?: {
        src: string
        type: string
        async: boolean
        defer: boolean
        [key: string]: any
    }[]
    styles?: {
        href: string
        [key: string]: any
    }[]
    fonts?: {
        family: string
        src: string
        weight?: string
        style?: string
        display?: string
        [key: string]: any
    }[]
    metas?: {
        property: string
        content: string
        [key: string]: any
    }[]
    [key: string]: any
}

export type GenerateMetadata = (ctx: Context) => Promise<Metadata>