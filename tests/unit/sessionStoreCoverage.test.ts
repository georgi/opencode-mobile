import type {
  FileDiff,
  Message,
  OpencodeClient,
  PermissionRequest,
  Project,
  Session,
  UserMessage,
  AssistantMessage,
  Event,
} from "@opencode-ai/sdk/v2/client"
import { useSessionStore } from "../../src/store/sessionStore"

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

const createMockAssistantMessage = (id: string, sessionId: string, created: number): AssistantMessage => ({
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

const createMockDiff = (file: string, additions: number, deletions: number): FileDiff => ({
  file,
  before: "",
  after: "content",
  additions,
  deletions,
})

const createMockPermission = (id: string, sessionId: string): PermissionRequest => ({
  id,
  sessionID: sessionId,
  permission: "Read files",
  patterns: ["*.ts"],
  metadata: {},
  always: [],
})

const createMockClient = () => {
  const projects: Project[] = [
    createMockProject("proj-1", "Project Alpha", "/repo/alpha"),
    createMockProject("proj-2", "Project Beta", "/repo/beta"),
  ]
  const sessions: Session[] = [
    createMockSession("session-1", "Session Alpha"),
    createMockSession("session-2", "Session Beta"),
  ]
  const messages: Message[] = [
    createMockUserMessage("msg-1", "session-1", 1000),
    createMockAssistantMessage("msg-2", "session-1", 2000),
    createMockUserMessage("msg-3", "session-1", 3000),
    createMockAssistantMessage("msg-4", "session-1", 4000),
  ]
  const diffs: FileDiff[] = [
    createMockDiff("src/app.ts", 10, 5),
    createMockDiff("src/utils.ts", 3, 1),
  ]
  const permissions: PermissionRequest[] = [
    createMockPermission("perm-1", "session-1"),
  ]

  return {
    project: {
      list: jest.fn(async ({ directory }: { directory?: string }) => {
        const filtered = projects.filter((p) => p.worktree === directory || !directory)
        return { data: filtered }
      }),
    },
    session: {
      create: jest.fn(async ({ directory, title }: { directory?: string; title?: string }) => ({
        data: createMockSession(`session-${Date.now()}`, title ?? "New Session"),
      })),
      prompt: jest.fn(async ({ sessionID, parts }: { sessionID: string; parts: Array<{ text: string }> }) => {
        const userMsg = createMockUserMessage(`user-${Date.now()}`, sessionID, Date.now())
        const assistantMsg = createMockAssistantMessage(`asst-${Date.now()}`, sessionID, Date.now() + 1)
        return {
          data: {
            info: assistantMsg,
            parts: parts.map((p) => ({ id: `part-${Date.now()}`, type: "text" as const, text: p.text })),
          },
        }
      }),
      list: jest.fn(async ({ directory }: { directory?: string }) => ({
        data: sessions,
      })),
      messages: jest.fn(async ({ sessionID }: { sessionID: string }) => ({
        data: messages.filter((m) => m.sessionID === sessionID).map((m) => ({
          info: m,
          parts: [],
        })),
      })),
      diff: jest.fn(async ({ sessionID }: { sessionID: string }) => ({
        data: diffs,
      })),
      abort: jest.fn(async () => ({ data: true })),
      revert: jest.fn(async () => ({ data: true })),
      unrevert: jest.fn(async () => ({ data: true })),
      summarize: jest.fn(async () => ({ data: true })),
      share: jest.fn(async ({ sessionID }: { sessionID: string }) => ({
        data: createMockSession(sessionID, "Shared Session"),
      })),
      unshare: jest.fn(async ({ sessionID }: { sessionID: string }) => ({
        data: createMockSession(sessionID, "Unshared Session"),
      })),
    },
    permission: {
      list: jest.fn(async () => ({ data: permissions })),
      reply: jest.fn(async () => ({ data: true })),
    },
    event: {
      subscribe: jest.fn(async () => ({
        stream: {
          [Symbol.asyncIterator]: () => ({
            next: async () => ({ done: true, value: undefined }),
          }),
        },
      })),
    },
  } as unknown as OpencodeClient
}

describe("SessionStore - Helper Functions", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  describe("resolveData", () => {
    it("returns data when result has no error", () => {
      const result = { data: { test: "value" }, error: undefined }
      expect(useSessionStore.getState() as any).not.toBeDefined()
    })

    it("returns undefined when result has error", () => {
      useSessionStore.setState({ lastError: "ERR SERVER UNAVAILABLE" })
      expect(useSessionStore.getState().lastError).toBeDefined()
    })
  })

  describe("Message sorting (newest-first)", () => {
    it("sorts messages by timestamp descending", () => {
      const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msg2 = createMockAssistantMessage("msg-2", "session-1", 3000)
      const msg3 = createMockAssistantMessage("msg-3", "session-1", 2000)

      useSessionStore.getState().setMessages([msg1, msg2, msg3])

      const state = useSessionStore.getState()
      expect(state.messages[0].id).toBe("msg-2")
      expect(state.messages[1].id).toBe("msg-3")
      expect(state.messages[2].id).toBe("msg-1")
    })

    it("appends message and re-sorts", () => {
      const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msg2 = createMockAssistantMessage("msg-2", "session-1", 2000)

      useSessionStore.getState().setMessages([msg1, msg2])

      const newMsg = createMockAssistantMessage("msg-3", "session-1", 1500)
      useSessionStore.getState().appendMessage(newMsg)

      const state = useSessionStore.getState()
      expect(state.messages[0].id).toBe("msg-2")
      expect(state.messages[1].id).toBe("msg-3")
      expect(state.messages[2].id).toBe("msg-1")
    })

    it("handles messages with same timestamp", () => {
      const timestamp = 1000
      const msg1 = createMockAssistantMessage("msg-1", "session-1", timestamp)
      const msg2 = createMockAssistantMessage("msg-2", "session-1", timestamp)

      useSessionStore.getState().setMessages([msg1, msg2])

      const state = useSessionStore.getState()
      expect(state.messages).toHaveLength(2)
    })

    it("handles message with undefined timestamp", () => {
      const msg = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msgNoTime = { ...msg, time: { created: undefined as any } }

      useSessionStore.getState().setMessages([msg, msgNoTime])

      const state = useSessionStore.getState()
      expect(state.messages).toHaveLength(2)
    })
  })

  describe("upsertMessage", () => {
    it("adds new message to empty list", () => {
      const msg = createMockAssistantMessage("msg-1", "session-1", 1000)

      useSessionStore.getState().setMessages([])
      useSessionStore.getState().appendMessage(msg)

      const state = useSessionStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].id).toBe("msg-1")
    })

    it("updates existing message", () => {
      const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msg1Updated = { ...msg1, time: { created: 2000 } }

      useSessionStore.getState().setMessages([msg1])
      useSessionStore.getState().appendMessage(msg1Updated)

      const state = useSessionStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0].time.created).toBe(2000)
    })

    it("maintains order after upsert", () => {
      const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msg2 = createMockAssistantMessage("msg-2", "session-1", 3000)
      const msg3 = createMockAssistantMessage("msg-3", "session-1", 2000)

      useSessionStore.getState().setMessages([msg1, msg2, msg3])

      const msg2Updated = { ...msg2, time: { created: 4000 } }
      useSessionStore.getState().appendMessage(msg2Updated)

      const state = useSessionStore.getState()
      expect(state.messages[0].id).toBe("msg-2")
      expect(state.messages[1].id).toBe("msg-3")
      expect(state.messages[2].id).toBe("msg-1")
    })
  })
})

describe("SessionStore - EnsureClient Behavior", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("returns client when online and client exists", async () => {
    const client = createMockClient()
    useSessionStore.setState({ client, isOffline: false })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeDefined()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("sets ERR OFFLINE and returns undefined when offline", async () => {
    const client = createMockClient()
    useSessionStore.setState({ client, isOffline: true })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
  })

  it("sets ERR SERVER UNAVAILABLE and returns undefined when no client", async () => {
    useSessionStore.setState({ client: undefined, isOffline: false })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("ERR OFFLINE takes precedence over ERR SERVER UNAVAILABLE", async () => {
    useSessionStore.setState({ client: undefined, isOffline: true })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
  })
})

describe("SessionStore - HydrateServers Integration", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("hydrates with multiple servers and selects correct one", async () => {
    const server1 = {
      id: "server-1",
      label: "Server 1",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo1",
      basicAuth: "token1",
    }
    const server2 = {
      id: "server-2",
      label: "Server 2",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo2",
      basicAuth: "token2",
    }

    useSessionStore.setState({
      servers: [server1, server2],
      currentServerId: "server-2",
      currentServer: server2,
    })

    await useSessionStore.getState().hydrateServers()

    const state = useSessionStore.getState()
    expect(state.currentServerId).toBe("server-2")
    expect(state.currentServer?.id).toBe("server-2")
    expect(state.servers).toHaveLength(2)
  })

  it("hydrates with no servers", async () => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
    })

    await useSessionStore.getState().hydrateServers()

    const state = useSessionStore.getState()
    expect(state.currentServerId).toBeUndefined()
    expect(state.currentServer).toBeUndefined()
    expect(state.servers).toEqual([])
  })

  it("hydrates with server id but server not found", async () => {
    useSessionStore.setState({
      servers: [],
      currentServerId: "non-existent",
    })

    await useSessionStore.getState().hydrateServers()

    const state = useSessionStore.getState()
    expect(state.currentServerId).toBe("non-existent")
    expect(state.currentServer).toBeUndefined()
  })
})

describe("SessionStore - SDK Method Error Handling", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("handles project.list returning undefined data", async () => {
    const client = createMockClient()
    client.project.list = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const projects = await useSessionStore.getState().fetchProjects()

    expect(projects).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.list returning undefined data", async () => {
    const client = createMockClient()
    client.session.list = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentProject: createMockProject("proj-1", "Project", "/repo"),
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const sessions = await useSessionStore.getState().fetchSessions()

    expect(sessions).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.messages returning undefined data", async () => {
    const client = createMockClient()
    client.session.messages = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const messages = await useSessionStore.getState().fetchMessages("session-1")

    expect(messages).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.diff returning undefined data", async () => {
    const client = createMockClient()
    client.session.diff = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const diffs = await useSessionStore.getState().fetchDiffs("session-1")

    expect(diffs).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    expect(useSessionStore.getState().isDiffsLoading).toBe(false)
    expect(useSessionStore.getState().diffsError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles permission.list returning undefined data", async () => {
    const client = createMockClient()
    client.permission.list = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const permissions = await useSessionStore.getState().fetchPermissions()

    expect(permissions).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles permission.reply returning undefined data", async () => {
    const client = createMockClient()
    client.permission.reply = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
      pendingPermissions: [createMockPermission("perm-1", "session-1")],
    })

    const result = await useSessionStore.getState().respondToPermission("perm-1", "once")

    expect(result).toBe(false)
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
  })

  it("handles session.create returning undefined data", async () => {
    const client = createMockClient()
    client.session.create = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.prompt returning undefined data", async () => {
    const client = createMockClient()
    client.session.prompt = jest.fn(async () => ({ data: undefined }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })
})
  })

  it("handles project.list error response", async () => {
    const client = createMockClient()
    client.project.list = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const projects = await useSessionStore.getState().fetchProjects()

    expect(projects).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.list error response", async () => {
    const client = createMockClient()
    client.session.list = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentProject: createMockProject("proj-1", "Project", "/repo"),
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const sessions = await useSessionStore.getState().fetchSessions()

    expect(sessions).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.messages error response", async () => {
    const client = createMockClient()
    client.session.messages = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const messages = await useSessionStore.getState().fetchMessages("session-1")

    expect(messages).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.diff error response", async () => {
    const client = createMockClient()
    client.session.diff = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const diffs = await useSessionStore.getState().fetchDiffs("session-1")

    expect(diffs).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    expect(useSessionStore.getState().isDiffsLoading).toBe(false)
    expect(useSessionStore.getState().diffsError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles permission.list error response", async () => {
    const client = createMockClient()
    client.permission.list = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const permissions = await useSessionStore.getState().fetchPermissions()

    expect(permissions).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles permission.reply error response", async () => {
    const client = createMockClient()
    client.permission.reply = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
      pendingPermissions: [createMockPermission("perm-1", "session-1")],
    })

    const result = await useSessionStore.getState().respondToPermission("perm-1", "once")

    expect(result).toBe(false)
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
  })

  it("handles session.create error response", async () => {
    const client = createMockClient()
    client.session.create = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const session = await useSessionStore.getState().createSession({ title: "Test" })

    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("handles session.prompt error response", async () => {
    const client = createMockClient()
    client.session.prompt = jest.fn(async () => ({ data: undefined, error: new Error("API Error") }))

    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })
})

describe("SessionStore - Event Simulation Tests", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("simulates session.created event handling", () => {
    const existingSession = createMockSession("session-1", "Existing")
    const newSession = createMockSession("session-new", "New Session")

    useSessionStore.setState({
      currentSession: existingSession,
      sessions: [existingSession],
    })

    useSessionStore.setState((state) => {
      const session = newSession
      return {
        currentSession: !state.currentSession || state.currentSession.id === session.id ? session : state.currentSession,
        sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)],
      }
    })

    const state = useSessionStore.getState()
    expect(state.sessions.some((s) => s.id === "session-new")).toBe(true)
    expect(state.currentSession?.id).toBe("session-new")
  })

  it("simulates session.updated event - different session", () => {
    const current = createMockSession("session-1", "Current")
    const other = createMockSession("session-2", "Other")

    useSessionStore.setState({
      currentSession: current,
      sessions: [current, other],
    })

    const updatedOther = { ...other, title: "Updated Other" }
    useSessionStore.setState((state) => {
      const session = updatedOther
      return {
        currentSession: !state.currentSession || state.currentSession.id === session.id ? session : state.currentSession,
        sessions: [session, ...state.sessions.filter((s) => s.id !== session.id)],
      }
    })

    const state = useSessionStore.getState()
    expect(state.currentSession?.id).toBe("session-1")
    expect(state.sessions.find((s) => s.id === "session-2")?.title).toBe("Updated Other")
  })

  it("simulates session.deleted event - current session", () => {
    const session1 = createMockSession("session-1", "Session 1")
    const session2 = createMockSession("session-2", "Session 2")

    useSessionStore.setState({
      currentSession: session1,
      sessions: [session1, session2],
    })

    useSessionStore.setState((state) => ({
      sessions: state.sessions.filter((s) => s.id !== "session-1"),
      currentSession: state.currentSession?.id === "session-1" ? undefined : state.currentSession,
    }))

    const state = useSessionStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.currentSession).toBeUndefined()
  })

  it("simulates session.deleted event - other session", () => {
    const session1 = createMockSession("session-1", "Session 1")
    const session2 = createMockSession("session-2", "Session 2")

    useSessionStore.setState({
      currentSession: session1,
      sessions: [session1, session2],
    })

    useSessionStore.setState((state) => ({
      sessions: state.sessions.filter((s) => s.id !== "session-2"),
      currentSession: state.currentSession?.id === "session-2" ? undefined : state.currentSession,
    }))

    const state = useSessionStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.currentSession?.id).toBe("session-1")
  })

  it("simulates message.updated event - new message", () => {
    const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)

    useSessionStore.setState({
      messages: [msg1],
    })

    const msg2 = createMockAssistantMessage("msg-2", "session-1", 2000)
    useSessionStore.setState((state) => {
      const message = msg2
      const messages = [...state.messages]
      const index = messages.findIndex((m) => m.id === message.id)
      if (index !== -1) {
        messages[index] = message
      } else {
        messages.unshift(message)
      }
      const sorted = [...messages].sort((a, b) => ((b.time?.created ?? 0) - (a.time?.created ?? 0)))
      return { messages: sorted }
    })

    const state = useSessionStore.getState()
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].id).toBe("msg-2")
  })

  it("simulates message.updated event - update existing", () => {
    const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)

    useSessionStore.setState({
      messages: [msg1],
    })

    const updatedMsg1 = { ...msg1, time: { created: 2000 } }
    useSessionStore.setState((state) => {
      const message = updatedMsg1
      const messages = [...state.messages]
      const index = messages.findIndex((m) => m.id === message.id)
      if (index !== -1) {
        messages[index] = message
      } else {
        messages.unshift(message)
      }
      const sorted = [...messages].sort((a, b) => ((b.time?.created ?? 0) - (a.time?.created ?? 0)))
      return { messages: sorted }
    })

    const state = useSessionStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].time.created).toBe(2000)
  })

  it("simulates permission.asked event - new permission", () => {
    useSessionStore.setState({
      pendingPermissions: [createMockPermission("perm-1", "session-1")],
    })

    const newPerm = createMockPermission("perm-2", "session-2")
    useSessionStore.setState((state) => {
      const permission = newPerm
      const exists = state.pendingPermissions.some((p) => p.id === permission.id)
      if (exists) {
        return state
      }
      return { pendingPermissions: [...state.pendingPermissions, permission] }
    })

    const state = useSessionStore.getState()
    expect(state.pendingPermissions).toHaveLength(2)
  })

  it("simulates permission.asked event - duplicate ignored", () => {
    const perm1 = createMockPermission("perm-1", "session-1")
    useSessionStore.setState({
      pendingPermissions: [perm1],
    })

    useSessionStore.setState((state) => {
      const permission = perm1
      const exists = state.pendingPermissions.some((p) => p.id === permission.id)
      if (exists) {
        return state
      }
      return { pendingPermissions: [...state.pendingPermissions, permission] }
    })

    const state = useSessionStore.getState()
    expect(state.pendingPermissions).toHaveLength(1)
  })

  it("simulates permission.replied event", () => {
    const perm1 = createMockPermission("perm-1", "session-1")
    const perm2 = createMockPermission("perm-2", "session-2")

    useSessionStore.setState({
      pendingPermissions: [perm1, perm2],
    })

    useSessionStore.setState((state) => ({
      pendingPermissions: state.pendingPermissions.filter((p) => p.id !== "perm-1"),
    }))

    const state = useSessionStore.getState()
    expect(state.pendingPermissions).toHaveLength(1)
    expect(state.pendingPermissions[0].id).toBe("perm-2")
  })

  it("simulates session.diff event", () => {
    useSessionStore.setState({
      diffs: [createMockDiff("file1.ts", 1, 1)],
      isDiffsLoading: true,
      diffsError: undefined,
    })

    const newDiffs = [
      createMockDiff("file2.ts", 5, 2),
      createMockDiff("file3.ts", 10, 0),
    ]

    useSessionStore.setState({
      diffs: newDiffs,
      isDiffsLoading: false,
      diffsError: undefined,
    })

    const state = useSessionStore.getState()
    expect(state.diffs).toHaveLength(2)
    expect(state.isDiffsLoading).toBe(false)
  })
})

describe("SessionStore - Complex State Transitions", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("handles full server switch workflow", async () => {
    const client1 = createMockClient()
    const server1 = {
      id: "server-1",
      label: "Server 1",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo1",
      basicAuth: "token1",
    }
    const server2 = {
      id: "server-2",
      label: "Server 2",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo2",
      basicAuth: "token2",
    }

    useSessionStore.setState({
      client: client1,
      currentServer: server1,
      currentProject: createMockProject("proj-1", "Project 1", "/repo1"),
      sessions: [createMockSession("session-1", "Session 1")],
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
    })

    await useSessionStore.getState().selectServer("server-2")

    const state = useSessionStore.getState()
    expect(state.currentServerId).toBe("server-2")
    expect(state.currentProject).toBeUndefined()
    expect(state.sessions).toEqual([])
    expect(state.messages).toEqual([])
    expect(state.lastError).toBeUndefined()
  })

  it("handles rapid state changes", async () => {
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }
    const project = createMockProject("proj-1", "Project", "/repo")
    const client = createMockClient()

    useSessionStore.setState({ client, currentServer: server })

    await useSessionStore.getState().fetchProjects()
    useSessionStore.getState().selectProject(project)
    await useSessionStore.getState().fetchSessions()
    const session = await useSessionStore.getState().createSession({ title: "Rapid" })

    const state = useSessionStore.getState()
    expect(state.projects).toHaveLength(2)
    expect(state.currentProject?.id).toBe("proj-1")
    expect(state.sessions).toHaveLength(1)
    expect(session).toBeDefined()
  })

  it("handles concurrent permission requests", () => {
    const perm1 = createMockPermission("perm-1", "session-1")
    const perm2 = createMockPermission("perm-2", "session-2")
    const perm3 = createMockPermission("perm-3", "session-3")

    useSessionStore.setState({ pendingPermissions: [perm1] })

    useSessionStore.setState((state) => ({
      pendingPermissions: [...state.pendingPermissions, perm2],
    }))

    useSessionStore.setState((state) => {
      const exists = state.pendingPermissions.some((p) => p.id === perm3.id)
      if (exists) return state
      return { pendingPermissions: [...state.pendingPermissions, perm3] }
    })

    const state = useSessionStore.getState()
    expect(state.pendingPermissions).toHaveLength(3)
  })

  it("handles session list updates", async () => {
    const client = createMockClient()
    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
      currentProject: createMockProject("proj-1", "Project", "/repo"),
    })

    await useSessionStore.getState().fetchSessions()

    const sessions = useSessionStore.getState().sessions
    expect(sessions).toHaveLength(2)

    useSessionStore.getState().setSessions([])
    expect(useSessionStore.getState().sessions).toEqual([])

    useSessionStore.getState().setSessions([createMockSession("session-new", "New")])
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })
})

describe("SessionStore - Error Recovery", () => {
  beforeEach(() => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
      currentServer: undefined,
      currentProject: undefined,
      sessions: [],
      messages: [],
      diffs: [],
      isDiffsLoading: false,
      projects: [],
      pendingPermissions: [],
      isOffline: false,
      lastError: undefined,
      messageParts: {},
      client: undefined,
    })
  })

  it("recovers from error after successful operation", async () => {
    const client = createMockClient()
    useSessionStore.setState({
      client,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    useSessionStore.setState({ lastError: "ERR SERVER UNAVAILABLE" })
    expect(useSessionStore.getState().lastError).toBeDefined()

    const projects = await useSessionStore.getState().fetchProjects()
    expect(projects).toBeDefined()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("clears error with clearError", () => {
    useSessionStore.setState({ lastError: "ERR OFFLINE" })
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")

    useSessionStore.getState().clearError()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("overwrites previous error with setError", () => {
    useSessionStore.setState({ lastError: "ERR OFFLINE" })
    useSessionStore.getState().setError("ERR INVALID COMMAND")

    expect(useSessionStore.getState().lastError).toBe("ERR INVALID COMMAND")
  })
})
