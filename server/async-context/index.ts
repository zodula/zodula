import { AsyncLocalStorage } from "async_hooks";
import type { Context } from "bxo";
import { Bunely } from "bunely";


export const dbcontext = new AsyncLocalStorage<{
    trx: Bunely | null
}>()

export const ctxContext = new AsyncLocalStorage<{
    ctx: Context<any>
}>()

export const globalContext = new AsyncLocalStorage<{
    global: {
        bypass: boolean
    }
}>()