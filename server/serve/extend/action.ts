import BXO from "bxo";
import { loader } from "../../loader";
import { ctxContext } from "../../async-context";

export function extendAction() {
    const bxo = new BXO()
    const actions = loader.from("action").list()

    for (const action of actions) {
        const method = action.config?.method || "POST";
        if (!["get", "post", "put", "patch", "delete"].includes(method?.toLowerCase())) {
            continue
        }
        bxo[method?.toLowerCase() as "get" | "post" | "put" | "patch" | "delete"](`/api/action/${action.action_path}`, async (ctx: any) => {
            try {
                ctxContext.enterWith({
                    ctx: ctx as any
                })
                const result = await action.handler(ctx)
                return result
            } catch (error: any) {
                return ctx.json({
                    error: error?.message || "Internal server error"
                }, error?.status || 500)
            }
        }, {
            body: action.config?.body ? action.config.body : undefined,
            query: action.config?.query ? action.config.query : undefined,
            params: action.config?.params ? action.config.params : undefined,
            // cookies: action.config?.cookies ? action.config.cookies : {},
            // headers: action.config?.headersf ? action.config.headers : {},
            response: action.config?.response ? action.config.response : undefined,
            detail: action.config?.detail ? action.config.detail : {
                summary: `${action.action_path}`,
                tags: [`Action: ${action.app_name}`],
            }
        })
    }
    return bxo
}