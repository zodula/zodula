import BXO from "bxo";
import { loader } from "../../loader";
import { ctxContext } from "../../async-context";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;
type Method = typeof METHODS[number];

function makeHandler(actionPath: string) {
    return async (ctx: any) => {
        try {
            // Always re-fetch from the loader so HMR handler updates take effect immediately
            const action = loader.from("action").list().find(a => a.action_path === actionPath);
            if (!action) {
                return ctx.json({ error: `Action "${actionPath}" not found` }, 404);
            }
            ctxContext.enterWith({ ctx: ctx as any });
            return await action.handler(ctx);
        } catch (error: any) {
            return ctx.json({
                error: error?.message || "Internal server error"
            }, error?.status || 500);
        }
    };
}

export function extendAction() {
    const bxo = new BXO()
    const actions = loader.from("action").list()

    // Static routes for all actions known at startup — full schema validation + OpenAPI docs.
    // The handler re-looks up from the loader on every request so that HMR handler
    // updates (file edits) are picked up without a restart.
    for (const action of actions) {
        const method = (action.config?.method || "POST").toLowerCase() as Method;
        if (!METHODS.includes(method)) continue;

        bxo[method](`/api/action/${action.action_path}`, makeHandler(action.action_path), {
            body: action.config?.body ?? undefined,
            query: action.config?.query ?? undefined,
            params: action.config?.params ?? undefined,
            response: action.config?.response ?? undefined,
            detail: action.config?.detail ?? {
                summary: action.action_path,
                tags: [`Action: ${action.app_name}`],
            },
        })
    }

    // Wildcard catch-all for actions added after startup via HMR.
    // Static routes above take precedence; this only fires for paths not yet registered.
    // No schema validation here — new actions are available immediately during dev.
    for (const method of METHODS) {
        bxo[method]("/api/action/*actionPath", async (ctx: any) => {
            const actionPath = (ctx.params as any)?.actionPath as string | undefined;
            if (!actionPath) return ctx.json({ error: "Missing action path" }, 400);
            return makeHandler(actionPath)(ctx);
        })
    }

    return bxo
}