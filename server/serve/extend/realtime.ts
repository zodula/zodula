import BXO from "bxo";
import { addConnection, getConnection, removeConnection, subscriptions } from "../../zodula/realtime";
import { ZodulaDoctypeHelper } from "../../zodula/doc/helper";
import type { DoctypeEvent } from "../../loader/plugins/doctype";
import { zodula } from "../..";
import { getUserFromSid } from "../../zodula/utils";
import { loader } from "../../loader";
import { ctxContext } from "../../async-context";

// id -> { paths }

export default function extendRealtime() {
    const bxo = new BXO()
    // doctype event realtime
    bxo.ws("/realtime", {
        async open(ws) {
            // Get user from session using cookies from websocket
            const sid = ws.data?.cookies?.zodula_sid as string | undefined;
            const user = sid ? await getUserFromSid(sid).catch(() => null) : null;
            addConnection(ws.data?.id, ws, user?.id || null)
        },
        close(ws) {
            removeConnection(ws.data?.id)
            delete subscriptions[ws.data?.id]
        },
        async message(ws, message) {
            const { type, path } = JSON.parse(message as string)
            if (type === "subscribe") {
                const { doctype, event } = path.split("/")
                const connection = getConnection(ws.data?.id)
                if (connection) {
                    // push to subscriptions
                    if (!subscriptions[ws.data?.id]) {
                        subscriptions[ws.data?.id] = { paths: [] }
                    }
                    const [_, zero, ...rest] = path.split("/")

                    // Get user from websocket cookies
                    const sid = ws.data?.cookies?.zodula_sid as string | undefined;
                    const user = sid ? await getUserFromSid(sid).catch(() => null) : null;

                    if (zero === "doctypes") {
                        const [doctype] = rest
                        // Set up context for permission checking
                        ctxContext.enterWith({
                            ctx: {
                                cookies: ws.data?.cookies || {}
                            } as any
                        });
                        
                        const roles = await zodula.session.roles()
                        const doctypeConfig = loader.from("doctype").get(doctype as Zodula.DoctypeName)
                        const { can } = await ZodulaDoctypeHelper.checkPermission(
                            doctype as Zodula.DoctypeName,
                            "can_select",
                            { id: "", owner: user?.id || null } as any,
                            {
                                bypass: false,
                                doctype: doctypeConfig,
                                user: user || { id: null },
                                roles
                            }
                        )
                        
                        if (can) {
                            if (!subscriptions[ws.data?.id]?.paths.includes(path)) {
                                subscriptions[ws.data?.id]?.paths.push(path)
                                ws.send(JSON.stringify({
                                    type: "log",
                                    message: "Subscribed to " + path,
                                }))
                            }
                        } else {
                            ws.send(JSON.stringify({
                                type: "log",
                                message: "You do not have permission to subscribe to " + path,
                            }))
                        }
                    } else if (zero === "backgrounds") {
                        // Background job subscriptions - require authentication
                        if (!user || !user.id) {
                            ws.send(JSON.stringify({
                                type: "log",
                                message: "You must be authenticated to subscribe to background jobs",
                            }))
                            return
                        }
                        
                        if (!subscriptions[ws.data?.id]?.paths.includes(path)) {
                            subscriptions[ws.data?.id]?.paths.push(path)
                            ws.send(JSON.stringify({
                                type: "log",
                                message: "Subscribed to " + path,
                            }))
                        }
                    }

                } else {
                    ws.send(JSON.stringify({
                        type: "log",
                        message: "Connection not found",
                    }))
                }
            }
        },
        drain(ws) {
            removeConnection(ws.data?.id)
            delete subscriptions[ws.data?.id]
        },
    })

    return bxo
}