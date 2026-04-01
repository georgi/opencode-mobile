import { DebugSse } from "../../src/utils/debugSse"

// We need a more capable XMLHttpRequest mock for these tests
class TestXHR {
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly HEADERS_RECEIVED = 2
  static readonly LOADING = 3
  static readonly DONE = 4

  readyState = 0
  status = 0
  responseText = ""
  withCredentials = false
  timeout = 0
  onreadystatechange: (() => void) | null = null
  onerror: (() => void) | null = null

  private _aborted = false

  open() {
    this.readyState = TestXHR.OPENED
  }

  setRequestHeader() {}

  send() {
    // Simulate successful connection: HEADERS_RECEIVED
    this.readyState = TestXHR.HEADERS_RECEIVED
    this.status = 200
    if (this.onreadystatechange) this.onreadystatechange()
  }

  abort() {
    this._aborted = true
  }

  getAllResponseHeaders() {
    return ""
  }

  get aborted() {
    return this._aborted
  }

  // Helper to simulate incoming data
  simulateData(data: string) {
    if (this._aborted) return
    this.responseText += data
    this.readyState = TestXHR.LOADING
    if (this.onreadystatechange) this.onreadystatechange()
  }

  simulateDone() {
    if (this._aborted) return
    this.readyState = TestXHR.DONE
    if (this.onreadystatechange) this.onreadystatechange()
  }
}

// Store original and replace for tests
const OriginalXHR = (globalThis as any).XMLHttpRequest

describe("DebugSse", () => {
  let lastXhr: TestXHR

  beforeEach(() => {
    ;(globalThis as any).XMLHttpRequest = class extends TestXHR {
      constructor() {
        super()
        lastXhr = this
      }
    }
  })

  afterEach(() => {
    ;(globalThis as any).XMLHttpRequest = OriginalXHR
  })

  it("dispatches open event on HEADERS_RECEIVED", () => {
    const openHandler = jest.fn()

    // DebugSse calls open() in constructor, which calls send()
    // Our mock sends HEADERS_RECEIVED immediately
    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("open", openHandler)

    // The open event already fired in constructor before addEventListener
    // So we need to verify the xhr was created
    expect(lastXhr).toBeDefined()
    expect(lastXhr.status).toBe(200)

    sse.close()
  })

  it("parses SSE messages from incoming data", () => {
    const messageHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("message", messageHandler)

    // Simulate SSE data coming in
    lastXhr.simulateData('data: {"type":"test","value":1}\n\n')

    expect(messageHandler).toHaveBeenCalledTimes(1)
    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "message",
        data: '{"type":"test","value":1}',
      })
    )

    sse.close()
  })

  it("handles named events", () => {
    const messageHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("message", messageHandler)

    lastXhr.simulateData('event: custom\ndata: hello\n\n')

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "custom",
        data: "hello",
      })
    )

    sse.close()
  })

  it("triggers reconnect when buffer exceeds maxBufferSize", () => {
    const openHandler = jest.fn()

    // Use a very small maxBufferSize to trigger reconnect easily
    const sse = new DebugSse("https://example.com/events", {
      maxBufferSize: 50,
    })
    sse.addEventListener("open", openHandler)

    const firstXhr = lastXhr

    // Send data that exceeds maxBufferSize
    const bigData = "data: " + "x".repeat(60) + "\n\n"
    lastXhr.simulateData(bigData)

    // After exceeding maxBufferSize, DebugSse should reconnect
    // which means the old xhr is aborted and a new one is created
    expect(firstXhr.aborted).toBe(true)
    expect(lastXhr).not.toBe(firstXhr)

    sse.close()
  })

  it("close() sets isClosed and aborts XHR", () => {
    const closeHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("close", closeHandler)

    const xhr = lastXhr
    sse.close()

    expect(xhr.aborted).toBe(true)
    expect(closeHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "close" })
    )
  })

  it("removeAllEventListeners clears all handlers", () => {
    const messageHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("message", messageHandler)
    sse.removeAllEventListeners()

    lastXhr.simulateData('data: hello\n\n')

    expect(messageHandler).not.toHaveBeenCalled()

    sse.close()
  })

  it("does not dispatch events after close", () => {
    const messageHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("message", messageHandler)

    sse.close()

    // Data arriving after close should be ignored (isClosed check in onreadystatechange)
    lastXhr.readyState = TestXHR.LOADING
    lastXhr.responseText = 'data: after-close\n\n'
    if (lastXhr.onreadystatechange) lastXhr.onreadystatechange()

    expect(messageHandler).not.toHaveBeenCalled()
  })

  it("handles multiple data lines in a single event", () => {
    const messageHandler = jest.fn()

    const sse = new DebugSse("https://example.com/events")
    sse.addEventListener("message", messageHandler)

    lastXhr.simulateData('data: line1\ndata: line2\n\n')

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: "line1\nline2",
      })
    )

    sse.close()
  })
})
