import type { WebSocketData } from "bxo"

export const realtimeConnections: Record<string, Bun.ServerWebSocket<WebSocketData>> = {}
export let subscriptions: Record<string, { paths: string[] }> = {}


export function addConnection(id: string, connection: Bun.ServerWebSocket<WebSocketData>) {
    realtimeConnections[id] = connection
}

export function removeConnection(id: string) {
    delete realtimeConnections[id]
}

export function getConnection(id: string) {
    return realtimeConnections[id]
}

export function getConnections() {
    return realtimeConnections
}

export function broadcast(message: string) {
    Object.values(realtimeConnections).forEach(connection => connection.send(message))
}

export class ZodulaRealtime {
    constructor() {
    }
}