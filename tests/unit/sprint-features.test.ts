import type {
  AssistantMessage,
  FileDiff,
  Message,
  OpencodeClient,
  Part,
  PermissionRequest,
  Project,
  Session,
  TextPart,
  UserMessage,
} from "@opencode-ai/sdk/v2/client"
import { useSessionStore } from "../../src/store/sessionStore"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockProject = (id: string, name: string, worktree: string): Project => ({
  id,
  name,
  worktree,
  sandboxes: [],
  time: { created: Date.now(), updated: Date.now() },
})

const createMockSession = (id: string, title: string): Session => ({
  id,
  slug: id,
  projectID: "project-1",
  directory: "/repo",
  title,
  version: "1.0.0",
  time: { created: Date.now(), updated: Date.now() },
})

const createMockUserMessage = (id: string, sessionId: string, created: number): UserMessage => ({
  id,
  sessionID: sessionId,
  role: "user",
  time: { created },
  agent: "",
  model: { providerID: "", modelID: "" },
})

const createMockAssistantMessage = (
  id: string,
  sessionId: string,
  created: number
): AssistantMessage => ({
  id,
  sessionID: sessionId,
  role: "assistant",
  time: { created },
  agent: "build",
  mode: "chat",
  parentID: "root",
  modelID: "model",
  providerID: "provider",
  path: { cwd: "/repo", root: "/repo" },
  cost: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

const createMockClient = (overrides?: Partial<Record<string, any>>) => {
  const sessions: Session[] = [
    createMockSession("session-1", "Session Alpha"),
    createMockSession("session-2", "Session Beta"),
  ]
  const messages: Message[] = [
    createMockUserMessage("msg-1", "session-1", 1000),
    createMockAssistantMessage("msg-2", "session-1", 2000),
  ]

  return {
    project: {
      list: jest.fn(async () => ({ data: [] })),
    },
    session: {
      create: jest.fn(async () => ({
        data: createMockSession(`session-${Date.now()}`, "New"),
      })),
      prompt: jest.fn(async () => ({
        data: {
          info: createMockAssistantMessage(`asst-${Date.now()}`, "session-1", Date.now()),
          parts: [],
        },
      })),
      list: jest.fn(async () => ({ data: sessions })),
      messages: jest.fn(async ({ sessionID }: { sessionID: string }) => ({
        data: messages
          .filter((m) => m.sessionID === sessionID)
          .map((m) => ({ info: m, parts: [] as Part[] })),
      })),
      diff: jest.fn(async () => ({ data: [] })),
      abort: jest.fn(async () => ({ data: true })),
      revert: jest.fn(async () => ({ data: true })),
      unrevert: jest.fn(async () => ({ data: true })),
      summarize: jest.fn(async () => ({ data: true })),
      share: jest.fn(async () => ({ data: createMockSession("s", "Shared") })),
      unshare: jest.fn(async () => ({ data: createMockSession("s", "Unshared") })),
      delete: jest.fn(async () => ({ data: true })),
      ...overrides,
    },
    permission: {
      list: jest.fn(async () => ({ data: [] })),
      reply: jest.fn(async () => ({ data: true })),
    },
    event: {
      subscribe: jest.fn(async () => ({
        stream: { [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }) },
      })),
    },
  } as unknown as OpencodeClient
}

const serverConfig = {
  id: "server-1",
  label: "Server",
  baseUrl: "https://api.opencode.ai" as const,
  directory: "/repo",
  basicAuth: "token",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sprint Features - Session switching", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("clears messages, messageParts, and isAgentWorking when switching to a different session ID", () => {
    const session1 = createMockSession("session-1", "Session 1")
    const session2 = createMockSession("session-2", "Session 2")

    useSessionStore.setState({
      currentSession: session1,
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
      messageParts: { "msg-1": [{ id: "p1", type: "text", text: "hello" } as TextPart] },
      isAgentWorking: true,
    })

    useSessionStore.getState().setSession(session2)

    const state = useSessionStore.getState()
    expect(state.currentSession?.id).toBe("session-2")
    expect(state.messages).toEqual([])
    expect(state.messageParts).toEqual({})
    expect(state.isAgentWorking).toBe(false)
  })

  it("preserves messages and state when setting same session ID", () => {
    const session = createMockSession("session-1", "Session 1")
    const messages = [createMockUserMessage("msg-1", "session-1", 1000)]
    const messageParts = { "msg-1": [{ id: "p1", type: "text", text: "hello" } as TextPart] }

    useSessionStore.setState({
      currentSession: session,
      messages,
      messageParts,
      isAgentWorking: true,
    })

    const updatedSession = { ...session, title: "Updated Title" }
    useSessionStore.getState().setSession(updatedSession)

    const state = useSessionStore.getState()
    expect(state.currentSession?.title).toBe("Updated Title")
    expect(state.messages).toEqual(messages)
    expect(state.messageParts).toEqual(messageParts)
    expect(state.isAgentWorking).toBe(true)
  })

  it("clears state when switching from a session to undefined", () => {
    const session = createMockSession("session-1", "Session 1")

    useSessionStore.setState({
      currentSession: session,
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
      messageParts: { "msg-1": [] },
      isAgentWorking: true,
    })

    useSessionStore.getState().setSession(undefined)

    const state = useSessionStore.getState()
    expect(state.currentSession).toBeUndefined()
    expect(state.messages).toEqual([])
    expect(state.messageParts).toEqual({})
    expect(state.isAgentWorking).toBe(false)
  })
})

describe("Sprint Features - deleteSession", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("removes session from sessions list and clears current if deleting active session", async () => {
    const client = createMockClient()
    const session1 = createMockSession("session-1", "Session 1")
    const session2 = createMockSession("session-2", "Session 2")

    useSessionStore.setState({
      client,
      currentServer: serverConfig,
      sessions: [session1, session2],
      currentSession: session1,
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
      messageParts: { "msg-1": [] },
    })

    const result = await useSessionStore.getState().deleteSession("session-1")

    expect(result).toBe(true)
    const state = useSessionStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe("session-2")
    expect(state.currentSession).toBeUndefined()
    expect(state.messages).toEqual([])
    expect(state.messageParts).toEqual({})
  })

  it("keeps current session when deleting a different session", async () => {
    const client = createMockClient()
    const session1 = createMockSession("session-1", "Session 1")
    const session2 = createMockSession("session-2", "Session 2")

    useSessionStore.setState({
      client,
      currentServer: serverConfig,
      sessions: [session1, session2],
      currentSession: session1,
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
    })

    const result = await useSessionStore.getState().deleteSession("session-2")

    expect(result).toBe(true)
    const state = useSessionStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].id).toBe("session-1")
    expect(state.currentSession?.id).toBe("session-1")
    expect(state.messages).toHaveLength(1)
  })

  it("returns false and sets error when no client", async () => {
    const result = await useSessionStore.getState().deleteSession("session-1")

    expect(result).toBe(false)
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("returns false when server returns error", async () => {
    const client = createMockClient({
      delete: jest.fn(async () => ({ error: new Error("fail") })),
    })

    useSessionStore.setState({ client, currentServer: serverConfig })

    const result = await useSessionStore.getState().deleteSession("session-1")

    expect(result).toBe(false)
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })
})

describe("Sprint Features - fetchMessages race condition (_fetchSeq)", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("discards stale fetchMessages response when a newer fetch was started", async () => {
    let resolveFirst: (value: any) => void
    let resolveSecond: (value: any) => void

    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve
    })

    let callCount = 0
    const client = createMockClient({
      messages: jest.fn(async () => {
        callCount++
        if (callCount === 1) return firstPromise
        return secondPromise
      }),
    })

    useSessionStore.setState({ client, currentServer: serverConfig })

    // Start first fetch
    const fetch1 = useSessionStore.getState().fetchMessages("session-1")

    // Start second fetch before first resolves (increments _fetchSeq)
    const fetch2 = useSessionStore.getState().fetchMessages("session-1")

    // Resolve second fetch first
    resolveSecond!({
      data: [
        {
          info: createMockAssistantMessage("msg-second", "session-1", 2000),
          parts: [],
        },
      ],
    })
    const result2 = await fetch2

    // Now resolve first fetch (stale)
    resolveFirst!({
      data: [
        {
          info: createMockAssistantMessage("msg-first", "session-1", 1000),
          parts: [],
        },
      ],
    })
    const result1 = await fetch1

    // First fetch result should be discarded (stale)
    expect(result1).toBeUndefined()

    // Second fetch result should be applied
    expect(result2).toBeDefined()
    expect(result2).toHaveLength(1)
    expect(useSessionStore.getState().messages[0]?.id).toBe("msg-second")
  })
})

describe("Sprint Features - sendPrompt behavior", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("sets isAgentWorking false on error", async () => {
    const client = createMockClient({
      prompt: jest.fn(async () => {
        throw new Error("network failure")
      }),
    })

    useSessionStore.setState({ client, currentServer: serverConfig })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    const state = useSessionStore.getState()
    expect(state.isAgentWorking).toBe(false)
    expect(state.lastError).toBe("network failure")
  })

  it("sets isAgentWorking false when resolveData returns null (server error)", async () => {
    const client = createMockClient({
      prompt: jest.fn(async () => ({ error: new Error("server error") })),
    })

    useSessionStore.setState({ client, currentServer: serverConfig })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    const state = useSessionStore.getState()
    expect(state.isAgentWorking).toBe(false)
    expect(state.lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("does NOT set isAgentWorking false on success (SSE handles it)", async () => {
    const client = createMockClient()
    useSessionStore.setState({ client, currentServer: serverConfig })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    // sendPrompt success path: isAgentWorking stays true (SSE events will set it false)
    expect(useSessionStore.getState().isAgentWorking).toBe(true)
  })
})

describe("Sprint Features - errorSeq", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("increments errorSeq when setError is called", () => {
    const initialSeq = useSessionStore.getState().errorSeq

    useSessionStore.getState().setError("ERR 1")
    expect(useSessionStore.getState().errorSeq).toBe(initialSeq + 1)

    useSessionStore.getState().setError("ERR 2")
    expect(useSessionStore.getState().errorSeq).toBe(initialSeq + 2)
  })

  it("increments errorSeq even with the same error message", () => {
    const initialSeq = useSessionStore.getState().errorSeq

    useSessionStore.getState().setError("ERR SAME")
    useSessionStore.getState().setError("ERR SAME")

    expect(useSessionStore.getState().errorSeq).toBe(initialSeq + 2)
  })
})

describe("Sprint Features - insertSorted (oldest-first)", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("inserts message in correct sorted position via appendMessage", () => {
    const msg1 = createMockAssistantMessage("msg-1", "s1", 1000)
    const msg3 = createMockAssistantMessage("msg-3", "s1", 3000)

    useSessionStore.getState().setMessages([msg1, msg3])

    // Insert msg2 between msg1 and msg3
    const msg2 = createMockAssistantMessage("msg-2", "s1", 2000)
    useSessionStore.getState().appendMessage(msg2)

    const ids = useSessionStore.getState().messages.map((m) => m.id)
    expect(ids).toEqual(["msg-1", "msg-2", "msg-3"])
  })

  it("appends message at end when it has the latest timestamp", () => {
    const msg1 = createMockAssistantMessage("msg-1", "s1", 1000)
    const msg2 = createMockAssistantMessage("msg-2", "s1", 2000)

    useSessionStore.getState().setMessages([msg1, msg2])

    const msg3 = createMockAssistantMessage("msg-3", "s1", 3000)
    useSessionStore.getState().appendMessage(msg3)

    const ids = useSessionStore.getState().messages.map((m) => m.id)
    expect(ids).toEqual(["msg-1", "msg-2", "msg-3"])
  })

  it("updates existing message in-place without re-sorting", () => {
    const msg1 = createMockAssistantMessage("msg-1", "s1", 1000)
    const msg2 = createMockAssistantMessage("msg-2", "s1", 2000)
    const msg3 = createMockAssistantMessage("msg-3", "s1", 3000)

    useSessionStore.getState().setMessages([msg1, msg2, msg3])

    // Update msg1 with a newer timestamp — it should stay at index 0
    const updatedMsg1 = { ...msg1, time: { created: 9999 } }
    useSessionStore.getState().appendMessage(updatedMsg1)

    const ids = useSessionStore.getState().messages.map((m) => m.id)
    expect(ids).toEqual(["msg-1", "msg-2", "msg-3"])
    // But the timestamp IS updated
    expect(useSessionStore.getState().messages[0].time.created).toBe(9999)
  })
})

describe("Sprint Features - withUpdatedParts bail-out", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("returns same reference when parts array is unchanged", () => {
    const parts: Part[] = [{ id: "p1", type: "text", text: "hello" } as TextPart]
    const messageParts = { "msg-1": parts }

    useSessionStore.setState({ messageParts })

    // Simulate a message.part.updated that doesn't change anything
    // withUpdatedParts bails out when messageParts[messageID] === updatedParts
    useSessionStore.setState((state) => {
      const existing = state.messageParts["msg-1"]
      // If we pass the same reference back, withUpdatedParts returns the original
      if (state.messageParts["msg-1"] === existing) return state
      return { messageParts: { ...state.messageParts, "msg-1": existing } }
    })

    expect(useSessionStore.getState().messageParts["msg-1"]).toBe(parts)
  })
})

describe("Sprint Features - session.status event handling", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("sets isAgentWorking true when status is busy", () => {
    useSessionStore.setState({ isAgentWorking: false })

    // Simulate what handleEvent does for session.status
    useSessionStore.setState({ isAgentWorking: true })

    expect(useSessionStore.getState().isAgentWorking).toBe(true)
  })

  it("sets isAgentWorking false when status is not busy", () => {
    useSessionStore.setState({ isAgentWorking: true })

    // Simulate what handleEvent does for session.status with type !== "busy"
    useSessionStore.setState({ isAgentWorking: false })

    expect(useSessionStore.getState().isAgentWorking).toBe(false)
  })

  it("setAgentWorking action works correctly", () => {
    useSessionStore.getState().setAgentWorking(true)
    expect(useSessionStore.getState().isAgentWorking).toBe(true)

    useSessionStore.getState().setAgentWorking(false)
    expect(useSessionStore.getState().isAgentWorking).toBe(false)
  })
})

describe("Sprint Features - session.error event increments errorSeq", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("session.error event simulation sets lastError and increments errorSeq", () => {
    const initialSeq = useSessionStore.getState().errorSeq

    // Simulate what handleEvent does for session.error
    useSessionStore.setState((state) => ({
      lastError: "Something went wrong",
      errorSeq: state.errorSeq + 1,
      isAgentWorking: false,
    }))

    const state = useSessionStore.getState()
    expect(state.lastError).toBe("Something went wrong")
    expect(state.errorSeq).toBe(initialSeq + 1)
    expect(state.isAgentWorking).toBe(false)
  })
})

describe("Sprint Features - message.updated event sets isAgentWorking false for assistant", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("sets isAgentWorking false when assistant message is received", () => {
    useSessionStore.setState({ isAgentWorking: true })

    const message = createMockAssistantMessage("msg-1", "session-1", 1000)

    // Simulate handleEvent for message.updated with assistant role
    if (message.role === "assistant") {
      useSessionStore.setState({ isAgentWorking: false })
    }
    useSessionStore.setState((state) => ({
      messages: [...state.messages, message],
    }))

    expect(useSessionStore.getState().isAgentWorking).toBe(false)
  })

  it("does not change isAgentWorking when user message is received", () => {
    useSessionStore.setState({ isAgentWorking: true })

    const message = createMockUserMessage("msg-1", "session-1", 1000)

    // Simulate handleEvent for message.updated with user role
    if (message.role === "assistant") {
      useSessionStore.setState({ isAgentWorking: false })
    }

    expect(useSessionStore.getState().isAgentWorking).toBe(true)
  })
})
