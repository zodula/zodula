import type { DoctypeEvent } from "@/zodula/server/loader/plugins/doctype"

export type BackgroundJobEvent = "start" | "complete" | "error" | "retry" | "failed"

/** Snapshot of the shared realtime WebSocket (one per tab). */
export type RealtimeSocketStatus = {
  /** `idle` means no WebSocket has been created yet. */
  state: "idle" | "connecting" | "open" | "closing" | "closed"
  /** Raw `WebSocket.readyState` when a socket exists; otherwise `null`. */
  readyState: number | null
}

let socket: WebSocket | null = null
let doctypeSubscriptions: Record<string, Record<string, (data: any) => void>> = {}
let backgroundSubscriptions: Record<string, Record<string, (data: any) => void>> = {}
const statusListeners = new Set<(status: RealtimeSocketStatus) => void>()

function computeSocketStatus(): RealtimeSocketStatus {
  if (!socket) return { state: "idle", readyState: null }
  const rs = socket.readyState
  if (rs === WebSocket.CONNECTING) return { state: "connecting", readyState: rs }
  if (rs === WebSocket.OPEN) return { state: "open", readyState: rs }
  if (rs === WebSocket.CLOSING) return { state: "closing", readyState: rs }
  return { state: "closed", readyState: rs }
}

function emitSocketStatus() {
  const s = computeSocketStatus()
  statusListeners.forEach((fn) => fn(s))
}

const getDoctypeSubscription = (doctype: Zodula.DoctypeName, event: DoctypeEvent) => {
  return doctypeSubscriptions[doctype]?.[event as any]
}

const getBackgroundSubscription = (jobName: string, event: BackgroundJobEvent) => {
  return backgroundSubscriptions[jobName]?.[event]
}

function handleSocketMessage(event: MessageEvent) {
  const data = JSON.parse(event.data)
  if (data.type === "log") {
    console.log("Realtime log: ", data.message)
  }
  if (data.type === "event") {
    for (const [, events] of Object.entries(doctypeSubscriptions)) {
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

function ensureSocket(baseUrl: string) {
  if (socket) return
  socket = new WebSocket(`${baseUrl}/realtime`)
  emitSocketStatus()
  socket.onopen = () => {
    console.log("Realtime socket opened")
    emitSocketStatus()
  }
  socket.onclose = () => {
    emitSocketStatus()
  }
  socket.onerror = () => {
    emitSocketStatus()
  }
  socket.onmessage = handleSocketMessage
}

export class ZodulaClientRealtime {
  private baseUrl = ""
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /** Current connection state of the shared realtime WebSocket. */
  getSocketStatus(): RealtimeSocketStatus {
    return computeSocketStatus()
  }

  /**
   * Subscribe to connection state updates. Invoked immediately with the current status.
   * Returns an unsubscribe function (call on unmount).
   */
  onSocketStatusChange(callback: (status: RealtimeSocketStatus) => void): () => void {
    statusListeners.add(callback)
    callback(computeSocketStatus())
    return () => {
      statusListeners.delete(callback)
    }
  }

  subscribe(
    doctype: Zodula.DoctypeName,
    event: DoctypeEvent,
    callback: (data: any) => void,
    options: {
      auth?: boolean
    } = {}
  ) {
    ensureSocket(this.baseUrl)

    if (!doctypeSubscriptions[doctype]) {
      doctypeSubscriptions[doctype] = {}
    }
    doctypeSubscriptions[doctype][event] = callback

    const sendSubscribe = () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            path: `/doctypes/${doctype}/${event}`,
          })
        )
      } else if (socket) {
        setTimeout(sendSubscribe, 100)
      }
    }
    sendSubscribe()
  }
  unsubscribe(doctype: "*" | Zodula.DoctypeName, event: "*" | DoctypeEvent) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "unsubscribe",
          path: `/realtime/${doctype}/${event}`,
        })
      )
    }
  }

  subscribeBackground(
    jobName: string,
    jobEvent: BackgroundJobEvent,
    callback: (data: any) => void,
    options: {
      auth?: boolean
    } = {}
  ) {
    ensureSocket(this.baseUrl)

    if (!backgroundSubscriptions[jobName]) {
      backgroundSubscriptions[jobName] = {}
    }
    backgroundSubscriptions[jobName][jobEvent] = callback

    const sendSubscribe = () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            path: `/backgrounds/${jobName}/${jobEvent}`,
          })
        )
      } else if (socket) {
        setTimeout(sendSubscribe, 100)
      }
    }
    sendSubscribe()
  }

  unsubscribeBackground(jobName: "*" | string, jobEvent: "*" | BackgroundJobEvent) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "unsubscribe",
          path: `/backgrounds/${jobName}/${jobEvent}`,
        })
      )
    }
  }
}
