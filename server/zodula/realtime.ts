import type { WebSocketData } from "bxo"

export const realtimeConnections: Record<string, Bun.ServerWebSocket<WebSocketData>> = {}
export const connectionUsers: Record<string, string | null> = {} // connection id -> user id
export let subscriptions: Record<string, { paths: string[] }> = {}


export function addConnection(id: string, connection: Bun.ServerWebSocket<WebSocketData>, userId?: string | null) {
    realtimeConnections[id] = connection
    connectionUsers[id] = userId || null
}

export function removeConnection(id: string) {
    delete realtimeConnections[id]
    delete connectionUsers[id]
}

export function getConnection(id: string) {
    return realtimeConnections[id]
}

export function getConnectionUserId(id: string) {
    return connectionUsers[id] || null
}

export function getConnections() {
    return realtimeConnections
}

export function broadcast(message: string) {
    Object.values(realtimeConnections).forEach(connection => connection.send(message))
}

export function broadcastToUsers(userIds: string[], message: string) {
    Object.entries(realtimeConnections).forEach(([id, connection]) => {
        const userId = connectionUsers[id]
        if (userId && userIds.includes(userId)) {
            connection.send(message)
        }
    })
}

export class ZodulaRealtime {
    constructor() {
    }
}