import type { DoctypeEvent } from "@/zodula/server/loader/plugins/doctype"
let socket: WebSocket | null = null
let doctypeSubscriptions: Record<string, Record<string, (data: any) => void>> = {}

const getDoctypeSubscription = (doctype: Zodula.DoctypeName, event: DoctypeEvent) => {
    return doctypeSubscriptions[doctype]?.[event as any]
}

export class ZodulaClientRealtime {
    private baseUrl = ""
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }
    subscribe(doctype: Zodula.DoctypeName, event: DoctypeEvent, callback: (data: any) => void, options: {
        auth?: boolean
    } = {}) {
        if (!socket) {
            socket = new WebSocket(`${this.baseUrl}/realtime`)
            socket.onopen = () => {
                console.log("Realtime socket opened")
            }
            socket.onmessage = (event) => {
                const data = JSON.parse(event.data)
                if (data.type === "log") {
                    console.log("Realtime log: ", data.message)
                }
                if (data.type === "event") {
                    const callback = getDoctypeSubscription(doctype, data.event)
                    if (callback) {
                        callback(data.data)
                    }
                }
            }
        }

        if (!doctypeSubscriptions[doctype]) {
            doctypeSubscriptions[doctype] = {}
        }
        doctypeSubscriptions[doctype][event] = callback

        const sendSubscribe = () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "subscribe",
                    path: `/doctypes/${doctype}/${event}`,
                }))
            } else if (socket) {
                setTimeout(sendSubscribe, 100); // retry after 100ms
            }
        }
        sendSubscribe();
    }
    unsubscribe(doctype: "*" | Zodula.DoctypeName, event: "*" | DoctypeEvent) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "unsubscribe",
                path: `/realtime/${doctype}/${event}`,
            }))
        }
    }
}