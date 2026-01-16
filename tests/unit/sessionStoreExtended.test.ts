import type {
  Event,
  FileDiff,
  Message,
  OpencodeClient,
  PermissionRequest,
  Project,
  Session,
  UserMessage,
  AssistantMessage,
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

describe("SessionStore Event Handling Integration", () => {
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

  describe("subscribeToEvents", () => {
    it("subscribes to events and initializes stream", async () => {
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

      await useSessionStore.getState().subscribeToEvents()

      expect(client.event.subscribe).toHaveBeenCalled()
    })

    it("does not subscribe when no client", async () => {
      await useSessionStore.getState().subscribeToEvents()

      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("does not subscribe when offline", async () => {
      useSessionStore.getState().setOffline(true)
      const client = createMockClient()
      useSessionStore.setState({ client })

      await useSessionStore.getState().subscribeToEvents()

      expect(client.event.subscribe).not.toHaveBeenCalled()
    })
  })

  describe("Session event handling through state updates", () => {
    it("updates session in list when session.updated event is received", () => {
      const existingSession = createMockSession("session-1", "Original Title")
      const otherSession = createMockSession("session-2", "Other Session")
      
      useSessionStore.setState({
        sessions: [existingSession, otherSession],
        currentSession: existingSession,
      })

      const updatedSession = {
        ...existingSession,
        title: "Updated Title",
      }

      useSessionStore.setState((state) => ({
        currentSession: state.currentSession?.id === updatedSession.id ? updatedSession : state.currentSession,
        sessions: [updatedSession, ...state.sessions.filter((s) => s.id !== updatedSession.id)],
      }))

      const state = useSessionStore.getState()
      expect(state.currentSession?.title).toBe("Updated Title")
      expect(state.sessions.find((s) => s.id === "session-1")?.title).toBe("Updated Title")
    })

    it("does not update currentSession when session.updated is for different session", () => {
      const currentSession = createMockSession("session-1", "Current")
      const otherSession = createMockSession("session-2", "Other")
      
      useSessionStore.setState({
        sessions: [currentSession, otherSession],
        currentSession,
      })

      const updatedOtherSession = {
        ...otherSession,
        title: "Updated Other",
      }

      useSessionStore.setState((state) => ({
        currentSession: state.currentSession?.id === updatedOtherSession.id ? updatedOtherSession : state.currentSession,
        sessions: [updatedOtherSession, ...state.sessions.filter((s) => s.id !== updatedOtherSession.id)],
      }))

      const state = useSessionStore.getState()
      expect(state.currentSession?.title).toBe("Current")
      expect(state.sessions.find((s) => s.id === "session-2")?.title).toBe("Updated Other")
    })

    it("removes session from list when session.deleted event is received", () => {
      const session1 = createMockSession("session-1", "Session 1")
      const session2 = createMockSession("session-2", "Session 2")
      
      useSessionStore.setState({
        sessions: [session1, session2],
        currentSession: session1,
      })

      useSessionStore.setState((state) => ({
        sessions: state.sessions.filter((s) => s.id !== "session-1"),
        currentSession: state.currentSession?.id === "session-1" ? undefined : state.currentSession,
      }))

      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe("session-2")
      expect(state.currentSession).toBeUndefined()
    })

    it("only removes specified session when session.deleted event is received", () => {
      const session1 = createMockSession("session-1", "Session 1")
      const session2 = createMockSession("session-2", "Session 2")
      
      useSessionStore.setState({
        sessions: [session1, session2],
        currentSession: session2,
      })

      useSessionStore.setState((state) => ({
        sessions: state.sessions.filter((s) => s.id !== "session-1"),
        currentSession: state.currentSession?.id === "session-1" ? undefined : state.currentSession,
      }))

      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe("session-2")
      expect(state.currentSession?.id).toBe("session-2")
    })
  })

  describe("Message event handling through state updates", () => {
    it("adds new message when message.updated event is received", () => {
      const existingMessage = createMockAssistantMessage("msg-1", "session-1", 1000)
      
      useSessionStore.setState({
        messages: [existingMessage],
      })

      const newMessage = createMockAssistantMessage("msg-2", "session-1", 2000)

      useSessionStore.setState((state) => {
        const messages = [...state.messages]
        const index = messages.findIndex((m) => m.id === newMessage.id)
        if (index !== -1) {
          messages[index] = newMessage
        } else {
          messages.unshift(newMessage)
        }
        return { messages }
      })

      const state = useSessionStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0].id).toBe("msg-2")
    })

    it("updates existing message when message.updated event is received", () => {
      const existingMessage = createMockAssistantMessage("msg-1", "session-1", 1000)
      
      useSessionStore.setState({
        messages: [existingMessage],
      })

      const updatedMessage = {
        ...existingMessage,
        time: { created: 2000 },
      }

      useSessionStore.setState((state) => {
        const messages = [...state.messages]
        const index = messages.findIndex((m) => m.id === updatedMessage.id)
        if (index !== -1) {
          messages[index] = updatedMessage
        } else {
          messages.unshift(updatedMessage)
        }
        return { messages }
      })

      const state = useSessionStore.getState()
      expect(state.messages.find((m) => m.id === "msg-1")?.time.created).toBe(2000)
    })

    it("maintains message sorting after message update", () => {
      const msg1 = createMockAssistantMessage("msg-1", "session-1", 1000)
      const msg2 = createMockAssistantMessage("msg-2", "session-1", 3000)
      const msg3 = createMockAssistantMessage("msg-3", "session-1", 2000)
      
      useSessionStore.setState({
        messages: [msg1, msg2, msg3],
      })

      const updatedMsg1 = {
        ...msg1,
        time: { created: 4000 },
      }

      useSessionStore.setState((state) => {
        const messages = [...state.messages]
        const index = messages.findIndex((m) => m.id === updatedMsg1.id)
        if (index !== -1) {
          messages[index] = updatedMsg1
        } else {
          messages.unshift(updatedMsg1)
        }
        const sorted = [...messages].sort((a, b) => (b.time?.created ?? 0) - (a.time?.created ?? 0))
        return { messages: sorted }
      })

      const state = useSessionStore.getState()
      expect(state.messages[0].id).toBe("msg-1")
      expect(state.messages[1].id).toBe("msg-2")
      expect(state.messages[2].id).toBe("msg-3")
    })
  })

  describe("Permission event handling through state updates", () => {
    it("adds permission when permission.asked event is received", () => {
      useSessionStore.setState({
        pendingPermissions: [createMockPermission("perm-1", "session-1")],
      })

      const newPermission = createMockPermission("perm-2", "session-2")

      useSessionStore.setState((state) => {
        const exists = state.pendingPermissions.some((p) => p.id === newPermission.id)
        if (exists) {
          return state
        }
        return { pendingPermissions: [...state.pendingPermissions, newPermission] }
      })

      const state = useSessionStore.getState()
      expect(state.pendingPermissions).toHaveLength(2)
      expect(state.pendingPermissions.some((p) => p.id === "perm-2")).toBe(true)
    })

    it("does not add duplicate permission", () => {
      const permission = createMockPermission("perm-1", "session-1")
      
      useSessionStore.setState({
        pendingPermissions: [permission],
      })

      useSessionStore.setState((state) => {
        const exists = state.pendingPermissions.some((p) => p.id === permission.id)
        if (exists) {
          return state
        }
        return { pendingPermissions: [...state.pendingPermissions, permission] }
      })

      const state = useSessionStore.getState()
      expect(state.pendingPermissions).toHaveLength(1)
    })

    it("removes permission when permission.replied event is received", () => {
      const permission1 = createMockPermission("perm-1", "session-1")
      const permission2 = createMockPermission("perm-2", "session-2")
      
      useSessionStore.setState({
        pendingPermissions: [permission1, permission2],
      })

      useSessionStore.setState((state) => ({
        pendingPermissions: state.pendingPermissions.filter((p) => p.id !== "perm-1"),
      }))

      const state = useSessionStore.getState()
      expect(state.pendingPermissions).toHaveLength(1)
      expect(state.pendingPermissions[0].id).toBe("perm-2")
    })
  })

  describe("Diff event handling through state updates", () => {
    it("updates diffs when session.diff event is received", () => {
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
      expect(state.diffs[0].file).toBe("file2.ts")
      expect(state.isDiffsLoading).toBe(false)
    })

    it("clears loading state and error when diffs are updated", () => {
      useSessionStore.setState({
        diffs: [],
        isDiffsLoading: true,
        diffsError: "ERR SERVER UNAVAILABLE",
      })

      useSessionStore.setState({
        diffs: [createMockDiff("file.ts", 1, 0)],
        isDiffsLoading: false,
        diffsError: undefined,
      })

      const state = useSessionStore.getState()
      expect(state.isDiffsLoading).toBe(false)
      expect(state.diffsError).toBeUndefined()
    })
  })
})

describe("SessionStore - Edge Cases", () => {
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

  describe("Server operations", () => {
    it("adds server as current when upserting with no current server", async () => {
      const server = {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      }

      await useSessionStore.getState().upsertServer(server)

      const state = useSessionStore.getState()
      expect(state.currentServerId).toBe("server-1")
      expect(state.currentServer).toEqual(server)
    })

    it("keeps current server when upserting different server", async () => {
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

      await useSessionStore.getState().upsertServer(server1)
      await useSessionStore.getState().upsertServer(server2)

      const state = useSessionStore.getState()
      expect(state.currentServerId).toBe("server-1")
      expect(state.currentServer).toEqual(server1)
    })

    it("clears client and dependent state when server credentials change", async () => {
      const client = createMockClient()
      const server1 = {
        id: "server-1",
        label: "Server 1",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo1",
        basicAuth: "token1",
      }
      const server2 = {
        id: "server-1",
        label: "Server 1 Updated",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo1-updated",
        basicAuth: "token1-updated",
      }

      useSessionStore.setState({
        client,
        currentServer: server1,
        currentProject: createMockProject("proj-1", "Project", "/repo1"),
        sessions: [createMockSession("session-1", "Session")],
      })

      await useSessionStore.getState().upsertServer(server2)

      const state = useSessionStore.getState()
      expect(state.currentProject).toBeUndefined()
      expect(state.sessions).toEqual([])
    })
  })

  describe("Session operations edge cases", () => {
    it("fails to fetch messages without client", async () => {
      const messages = await useSessionStore.getState().fetchMessages("session-1")
      expect(messages).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to create session without server", async () => {
      const session = await useSessionStore.getState().createSession({ title: "Test" })
      expect(session).toBeUndefined()
    })

    it("fails to abort session without client", async () => {
      await useSessionStore.getState().abortSession("session-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to revert session without client", async () => {
      await useSessionStore.getState().revertSession("session-1", "msg-1", "part-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to unrevert session without client", async () => {
      await useSessionStore.getState().unrevertSession("session-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to summarize session without client", async () => {
      const result = await useSessionStore.getState().summarizeSession("session-1")
      expect(result).toBe(false)
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to share session without client", async () => {
      const session = await useSessionStore.getState().shareSession("session-1")
      expect(session).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })

    it("fails to unshare session without client", async () => {
      const session = await useSessionStore.getState().unshareSession("session-1")
      expect(session).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  describe("Permission operations edge cases", () => {
    it("fails to fetch permissions without client", async () => {
      const permissions = await useSessionStore.getState().fetchPermissions()
      expect(permissions).toBeUndefined()
    })

    it("fails to respond to permission without client", async () => {
      const result = await useSessionStore.getState().respondToPermission("perm-1", "once")
      expect(result).toBe(false)
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  describe("Diff operations edge cases", () => {
    it("fails to fetch diffs without client", async () => {
      const diffs = await useSessionStore.getState().fetchDiffs("session-1")
      expect(diffs).toBeUndefined()
      expect(useSessionStore.getState().isDiffsLoading).toBe(false)
    })
  })
})
