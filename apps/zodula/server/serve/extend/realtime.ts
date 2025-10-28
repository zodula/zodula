import BXO from "bxo";
import { addConnection, getConnection, removeConnection, subscriptions } from "../../zodula/realtime";
import { ZodulaDoctypeHelper } from "../../zodula/doc/helper";
import type { DoctypeEvent } from "../../loader/plugins/doctype";
import { zodula } from "../..";
import { getUserFromSid } from "../../zodula/utils";
import { loader } from "../../loader";

// id -> { paths }

export default function extendRealtime() {
    const bxo = new BXO()
    // doctype event realtime
    bxo.ws("/realtime", {
        open(ws) {
            addConnection(ws.data?.id, ws)
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

                    if (zero === "doctypes") {
                        const [doctype] = rest
                        const user = await zodula.session.user(true).catch(() => null)
                        const roles = await zodula.session.roles()
                        const doctypeConfig = loader.from("doctype").get(doctype as Zodula.DoctypeName)
                        const { can, userPermissionCan } = await ZodulaDoctypeHelper.checkPermission(
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
                        
                        if (can && userPermissionCan) {
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