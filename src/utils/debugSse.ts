type EventHandler = (event: { type: string; data?: string; message?: string; error?: unknown }) => void

type DebugSseOptions = {
  method?: string
  timeout?: number
  withCredentials?: boolean
  headers?: Record<string, string>
  body?: string
  debug?: boolean
}

type ListenerMap = Record<string, EventHandler[]>

export class DebugSse {
  private url: string
  private method: string
  private timeout: number
  private withCredentials: boolean
  private headers: Record<string, string>
  private body?: string
  private debug: boolean
  private xhr: XMLHttpRequest | null = null
  private listeners: ListenerMap = { open: [], message: [], error: [], close: [] }
  private lastIndexProcessed = 0
  private isClosed = false

  constructor(url: string, options: DebugSseOptions = {}) {
    this.url = url
    this.method = options.method ?? "GET"
    this.timeout = options.timeout ?? 0
    this.withCredentials = options.withCredentials ?? false
    this.headers = options.headers ?? {}
    this.body = options.body
    this.debug = options.debug ?? false
    this.open()
  }

  addEventListener(type: string, handler: EventHandler) {
    const list = this.listeners[type] ?? []
    list.push(handler)
    this.listeners[type] = list
  }

  removeAllEventListeners() {
    this.listeners = { open: [], message: [], error: [], close: [] }
  }

  close() {
    this.isClosed = true
    if (this.xhr) {
      this.xhr.abort()
      this.xhr = null
    }
    this.dispatch("close", { type: "close" })
  }

  private log(...args: unknown[]) {
    if (this.debug) {
      console.log(...args)
    }
  }

  private dispatch(type: string, event: { type: string; data?: string; message?: string; error?: unknown }) {
    const handlers = this.listeners[type] ?? []
    for (const handler of handlers) {
      handler(event)
    }
  }

  private open() {
    this.log("🧪 SSE open", { url: this.url, method: this.method, headers: this.headers })
    this.xhr = new XMLHttpRequest()
    this.xhr.open(this.method, this.url, true)
    this.xhr.withCredentials = this.withCredentials
    this.xhr.setRequestHeader("Accept", "text/event-stream")
    this.xhr.setRequestHeader("Cache-Control", "no-cache")
    this.xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
    for (const [key, value] of Object.entries(this.headers)) {
      this.xhr.setRequestHeader(key, value)
    }
    this.xhr.timeout = this.timeout

    this.xhr.onreadystatechange = () => {
      if (!this.xhr || this.isClosed) return

      const { readyState, status, responseText } = this.xhr
      this.log("🧪 SSE state", { readyState, status, length: responseText?.length ?? 0 })

      if (readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        const headers = this.xhr.getAllResponseHeaders()
        this.log("🧪 SSE headers", { status, headers })
        this.dispatch("open", { type: "open" })
      }

      if (readyState === XMLHttpRequest.LOADING || readyState === XMLHttpRequest.DONE) {
        if (status >= 200 && status < 400) {
          this.consume(responseText ?? "")
          if (readyState === XMLHttpRequest.DONE) {
            this.dispatch("close", { type: "close" })
          }
        } else if (status !== 0) {
          this.dispatch("error", { type: "error", message: responseText })
        }
      }
    }

    this.xhr.onerror = () => {
      if (this.isClosed) return
      const message = this.xhr?.responseText
      this.dispatch("error", { type: "error", message })
    }

    try {
      if (this.body) this.xhr.send(this.body)
      else this.xhr.send()
    } catch (error) {
      this.dispatch("error", { type: "exception", error })
    }
  }

  private consume(response: string) {
    const chunk = response.slice(this.lastIndexProcessed)
    if (!chunk) return

    const normalized = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const parts = normalized.split("\n\n")

    if (!response.endsWith("\n\n")) {
      // Keep the last partial event in the buffer.
      const tail = parts.pop()
      this.lastIndexProcessed = response.length - (tail?.length ?? 0)
    } else {
      this.lastIndexProcessed = response.length
    }

    for (const part of parts) {
      if (!part.trim()) continue
      let data = ""
      let eventName = "message"
      for (const line of part.split("\n")) {
        if (line.startsWith("data:")) data += line.replace(/^data:\s*/, "") + "\n"
        else if (line.startsWith("event:")) eventName = line.replace(/^event:\s*/, "") || "message"
      }
      if (data.endsWith("\n")) data = data.slice(0, -1)
      this.dispatch("message", { type: eventName, data })
    }
  }
}
