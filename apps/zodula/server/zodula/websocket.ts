let connections: Record<string, WebSocket> = {}

export class ZodulaWebsocketServer {
    constructor() {
        
    }

    addConnection(id: string, connection: WebSocket) {
        connections[id] = connection
    }

    removeConnection(id: string) {
        delete connections[id]
    }

    broadcast(clients: string[], message: string) {
        Object.entries(connections).forEach(([id, c]) => {
            if (clients.includes(id)) {
                c.send(message)
            }
        })
    }

    closeAllConnections() {
        Object.values(connections).forEach(c => c.close())
    }
}