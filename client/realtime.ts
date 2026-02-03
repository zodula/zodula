import type { DoctypeEvent } from "@/zodula/server/loader/plugins/doctype"

export type BackgroundJobEvent = "start" | "complete" | "error" | "retry" | "failed"

let socket: WebSocket | null = null
let doctypeSubscriptions: Record<string, Record<string, (data: any) => void>> = {}
let backgroundSubscriptions: Record<string, Record<string, (data: any) => void>> = {}

const getDoctypeSubscription = (doctype: Zodula.DoctypeName, event: DoctypeEvent) => {
    return doctypeSubscriptions[doctype]?.[event as any]
}

const getBackgroundSubscription = (jobName: string, event: BackgroundJobEvent) => {
    return backgroundSubscriptions[jobName]?.[event]
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
                    // Handle doctype events - find matching subscription
                    for (const [doctype, events] of Object.entries(doctypeSubscriptions)) {
                        const callback = events[data.event as any]
                        if (callback) {
                            callback(data.data)
                        }
                    }
                }
                if (data.type === "background_event") {
                    const callback = getBackgroundSubscription(data.background_path, data.event)
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
    
    subscribeBackground(jobName: string, jobEvent: BackgroundJobEvent, callback: (data: any) => void, options: {
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
                    // Handle doctype events - find matching subscription
                    for (const [doctype, events] of Object.entries(doctypeSubscriptions)) {
                        const callback = events[data.event as any]
                        if (callback) {
                            callback(data.data)
                        }
                    }
                }
                if (data.type === "background_event") {
                    const callback = getBackgroundSubscription(data.background_path, data.event)
                    if (callback) {
                        callback(data.data)
                    }
                }
            }
        }

        if (!backgroundSubscriptions[jobName]) {
            backgroundSubscriptions[jobName] = {}
        }
        backgroundSubscriptions[jobName][jobEvent] = callback

        const sendSubscribe = () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "subscribe",
                    path: `/backgrounds/${jobName}/${jobEvent}`,
                }))
            } else if (socket) {
                setTimeout(sendSubscribe, 100); // retry after 100ms
            }
        }
        sendSubscribe();
    }
    
    unsubscribeBackground(jobName: "*" | string, jobEvent: "*" | BackgroundJobEvent) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "unsubscribe",
                path: `/backgrounds/${jobName}/${jobEvent}`,
            }))
        }
    }
}