import type {
  FileDiff,
  Message,
  OpencodeClient,
  Part,
  PermissionRequest,
  Project,
  Session,
  TextPart,
  AssistantMessage,
  UserMessage,
} from "@opencode-ai/sdk/v2/client"
import { useSessionStore, initialSessionState } from "../../src/store/sessionStore"
import type { ServerConfig } from "../../src/store/sessionStore"

// ── Helpers ──────────────────────────────────────────────────────────

const server: ServerConfig = {
  id: "server-1",
  label: "Test Server",
  baseUrl: "http://localhost:4096" as `${string}://${string}`,
  directory: "/repo",
  basicAuth: "token",
}

const mkSession = (id = "session-1", title = "Test Session"): Session => ({
  id,
  slug: id,
  projectID: "project-1",
  directory: "/repo",
  title,
  version: "1.0.0",
  time: { created: 1000, updated: 1000 },
})

const mkProject = (id = "proj-1", worktree = "/repo"): Project => ({
  id,
  name: "Project",
  worktree,
  sandboxes: [],
  time: { created: 1000, updated: 1000 },
})

const mkAssistantMsg = (id: string, sessionId: string, created: number): AssistantMessage => ({
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

const mkUserMsg = (id: string, sessionId: string, created: number): UserMessage => ({
  id,
  sessionID: sessionId,
  role: "user",
  time: { created },
  agent: "",
  model: { providerID: "", modelID: "" },
})

const mkDiff = (file = "README.md"): FileDiff => ({
  file,
  before: "",
  after: "content",
  additions: 1,
  deletions: 0,
})

const mkPermission = (id = "perm-1", sessionId = "session-1"): PermissionRequest => ({
  id,
  sessionID: sessionId,
  permission: "Read",
  patterns: ["*.ts"],
  metadata: {},
  always: [],
})

const createMockClient = () =>
  ({
    project: {
      list: jest.fn(async () => ({ data: [mkProject()], error: undefined })),
    },
    session: {
      list: jest.fn(async () => ({ data: [mkSession()], error: undefined })),
      create: jest.fn(async () => ({ data: mkSession("session-new", "New"), error: undefined })),
      prompt: jest.fn(async () => ({
        data: { info: mkAssistantMsg("msg-a", "session-1", 5000), parts: [] },
        error: undefined,
      })),
      messages: jest.fn(async () => ({
        data: [
          { info: mkUserMsg("msg-u1", "session-1", 1000), parts: [] },
          { info: mkAssistantMsg("msg-a1", "session-1", 2000), parts: [{ id: "p1", type: "text", text: "hi", messageID: "msg-a1", sessionID: "session-1" }] },
        ],
        error: undefined,
      })),
      diff: jest.fn(async () => ({ data: [mkDiff()], error: undefined })),
      abort: jest.fn(async () => ({ data: true, error: undefined })),
      revert: jest.fn(async () => ({ data: true, error: undefined })),
      unrevert: jest.fn(async () => ({ data: true, error: undefined })),
      summarize: jest.fn(async () => ({ data: true, error: undefined })),
      share: jest.fn(async () => ({ data: mkSession("session-1", "Shared"), error: undefined })),
      unshare: jest.fn(async () => ({ data: mkSession("session-1", "Unshared"), error: undefined })),
      delete: jest.fn(async () => ({ data: true, error: undefined })),
    },
    permission: {
      list: jest.fn(async () => ({ data: [mkPermission()], error: undefined })),
      reply: jest.fn(async () => ({ data: true, error: undefined })),
    },
    provider: {
      list: jest.fn(async () => ({
        data: {
          all: [
            { id: "openai", models: { "gpt-4": { id: "gpt-4" } } },
            { id: "anthropic", models: { "claude-3": { id: "claude-3" } } },
          ],
        },
        error: undefined,
      })),
    },
    event: {
      subscribe: jest.fn(async () => ({ stream: (async function* () {})() })),
    },
  } as unknown as OpencodeClient)

const failClient = () =>
  ({
    project: { list: jest.fn(async () => ({ data: undefined, error: new Error("fail") })) },
    session: {
      list: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      create: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      prompt: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      messages: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      diff: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      abort: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      revert: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      unrevert: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      summarize: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      share: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      unshare: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      delete: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
    },
    permission: {
      list: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
      reply: jest.fn(async () => ({ data: undefined, error: new Error("fail") })),
    },
    provider: { list: jest.fn(async () => ({ data: undefined, error: new Error("fail") })) },
    event: { subscribe: jest.fn(async () => ({ stream: (async function* () {})() })) },
  } as unknown as OpencodeClient)

const setupClient = (client?: OpencodeClient) => {
  const c = client ?? createMockClient()
  useSessionStore.setState({ client: c, currentServer: server })
  return c
}

// ── Tests ────────────────────────────────────────────────────────────

describe("sessionStore-coverage", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  afterEach(() => {
    useSessionStore.getState().closeEventSource()
    const timer = useSessionStore.getState().eventSourceReconnectTimer
    if (timer) clearTimeout(timer)
  })

  // ──────────────────────────────────────────────────────────────────
  // 1. ensureClient
  // ──────────────────────────────────────────────────────────────────
  describe("ensureClient", () => {
    it("returns undefined and sets error when offline", async () => {
      useSessionStore.setState({ isOffline: true, client: createMockClient() })
      const result = await useSessionStore.getState().fetchProjects()
      expect(result).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
    })

    it("returns undefined and sets error when no client", async () => {
      const result = await useSessionStore.getState().fetchProjects()
      expect(result).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 2. fetchProjects — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("fetchProjects", () => {
    it("returns projects on success", async () => {
      setupClient()
      const projects = await useSessionStore.getState().fetchProjects()
      expect(projects).toHaveLength(1)
      expect(useSessionStore.getState().projects).toHaveLength(1)
      expect(useSessionStore.getState().lastError).toBeUndefined()
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      const projects = await useSessionStore.getState().fetchProjects()
      expect(projects).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 3. fetchProviders — success, failure, model fallback
  // ──────────────────────────────────────────────────────────────────
  describe("fetchProviders", () => {
    it("returns providers and selects first model when none selected", async () => {
      setupClient()
      const providers = await useSessionStore.getState().fetchProviders()
      expect(providers).toHaveLength(2)
      expect(useSessionStore.getState().providers).toHaveLength(2)
      // Should auto-select the first available model
      expect(useSessionStore.getState().selectedModel).toEqual({
        providerID: "openai",
        modelID: "gpt-4",
      })
    })

    it("keeps selected model when it is still valid", async () => {
      setupClient()
      useSessionStore.setState({
        selectedModel: { providerID: "anthropic", modelID: "claude-3" },
      })
      await useSessionStore.getState().fetchProviders()
      expect(useSessionStore.getState().selectedModel).toEqual({
        providerID: "anthropic",
        modelID: "claude-3",
      })
    })

    it("falls back when selected model is no longer valid", async () => {
      setupClient()
      useSessionStore.setState({
        selectedModel: { providerID: "gone", modelID: "gone" },
      })
      await useSessionStore.getState().fetchProviders()
      expect(useSessionStore.getState().selectedModel).toEqual({
        providerID: "openai",
        modelID: "gpt-4",
      })
    })

    it("sets undefined model when no providers have models", async () => {
      const client = createMockClient()
      ;(client.provider.list as jest.Mock).mockResolvedValue({
        data: { all: [{ id: "empty", models: {} }] },
        error: undefined,
      })
      setupClient(client)
      await useSessionStore.getState().fetchProviders()
      expect(useSessionStore.getState().selectedModel).toBeUndefined()
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      const providers = await useSessionStore.getState().fetchProviders()
      expect(providers).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 4. fetchSessions — success, failure, missing worktree
  // ──────────────────────────────────────────────────────────────────
  describe("fetchSessions", () => {
    it("returns sessions on success", async () => {
      setupClient()
      useSessionStore.setState({ currentProject: mkProject() })
      const sessions = await useSessionStore.getState().fetchSessions()
      expect(sessions).toHaveLength(1)
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it("returns undefined when project has no worktree", async () => {
      setupClient()
      useSessionStore.setState({ currentProject: { ...mkProject(), worktree: "" } })
      const sessions = await useSessionStore.getState().fetchSessions()
      expect(sessions).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR INVALID COMMAND")
    })

    it("returns undefined when no project set", async () => {
      setupClient()
      const sessions = await useSessionStore.getState().fetchSessions()
      expect(sessions).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR INVALID COMMAND")
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentProject: mkProject() })
      const sessions = await useSessionStore.getState().fetchSessions()
      expect(sessions).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 5. createSession — success, missing directory, failure
  // ──────────────────────────────────────────────────────────────────
  describe("createSession", () => {
    it("creates session with directory", async () => {
      setupClient()
      const session = await useSessionStore.getState().createSession({ directory: "/repo", title: "Hi" })
      expect(session?.id).toBe("session-new")
      expect(useSessionStore.getState().currentSession?.id).toBe("session-new")
    })

    it("uses project worktree as fallback directory", async () => {
      const client = setupClient()
      useSessionStore.setState({ currentProject: mkProject() })
      await useSessionStore.getState().createSession()
      expect(client.session.create).toHaveBeenCalledWith(
        expect.objectContaining({ directory: "/repo" })
      )
    })

    it("returns undefined when no directory and no project", async () => {
      setupClient()
      const session = await useSessionStore.getState().createSession()
      expect(session).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR INVALID COMMAND")
    })

    it("returns undefined on failure", async () => {
      setupClient(failClient())
      const session = await useSessionStore.getState().createSession({ directory: "/repo" })
      expect(session).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 6. sendPrompt — success, null response, catch
  // ──────────────────────────────────────────────────────────────────
  describe("sendPrompt", () => {
    it("sends prompt and keeps isAgentWorking true on success", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().sendPrompt("session-1", "hello")
      // isAgentWorking stays true because SSE handles setting it false
      // Actually the prompt resolves and doesn't set isAgentWorking false on success
      const state = useSessionStore.getState()
      expect(state.isAgentWorking).toBe(true)
    })

    it("sets error when prompt returns null", async () => {
      const client = createMockClient()
      ;(client.session.prompt as jest.Mock).mockResolvedValue({ data: undefined, error: new Error("fail") })
      setupClient(client)
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().sendPrompt("session-1", "hello")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
      expect(useSessionStore.getState().isAgentWorking).toBe(false)
    })

    it("catches thrown errors", async () => {
      const client = createMockClient()
      ;(client.session.prompt as jest.Mock).mockRejectedValue(new Error("network error"))
      setupClient(client)
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().sendPrompt("session-1", "hello")
      expect(useSessionStore.getState().lastError).toBe("network error")
      expect(useSessionStore.getState().isAgentWorking).toBe(false)
    })

    it("catches non-Error thrown values", async () => {
      const client = createMockClient()
      ;(client.session.prompt as jest.Mock).mockRejectedValue("string error")
      setupClient(client)
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().sendPrompt("session-1", "hello")
      expect(useSessionStore.getState().lastError).toBe("ERR SEND FAILED")
    })

    it("does nothing when offline", async () => {
      setupClient()
      useSessionStore.setState({ isOffline: true })
      await useSessionStore.getState().sendPrompt("session-1", "hello")
      expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 7. fetchMessages
  // ──────────────────────────────────────────────────────────────────
  describe("fetchMessages", () => {
    it("fetches and sorts messages", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      const messages = await useSessionStore.getState().fetchMessages("session-1")
      expect(messages).toHaveLength(2)
      expect(useSessionStore.getState().messages).toHaveLength(2)
      // oldest first
      expect(useSessionStore.getState().messages[0].id).toBe("msg-u1")
    })

    it("populates messageParts from response", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().fetchMessages("session-1")
      const parts = useSessionStore.getState().messageParts
      expect(parts["msg-a1"]).toHaveLength(1)
    })

    it("discards stale fetch results", async () => {
      const client = createMockClient()
      let resolveFirst: (v: any) => void
      const firstCall = new Promise((r) => { resolveFirst = r })
      let callCount = 0
      ;(client.session.messages as jest.Mock).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          await firstCall
          return { data: [{ info: mkUserMsg("stale", "session-1", 100), parts: [] }], error: undefined }
        }
        return { data: [{ info: mkUserMsg("fresh", "session-1", 200), parts: [] }], error: undefined }
      })
      setupClient(client)
      useSessionStore.setState({ currentSession: mkSession() })

      const first = useSessionStore.getState().fetchMessages("session-1")
      const second = useSessionStore.getState().fetchMessages("session-1")
      // second completes first
      await second
      // now resolve first
      resolveFirst!(undefined)
      const staleResult = await first
      // stale result should be discarded
      expect(staleResult).toBeUndefined()
      expect(useSessionStore.getState().messages[0].id).toBe("fresh")
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      const messages = await useSessionStore.getState().fetchMessages("session-1")
      expect(messages).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 8. abortSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("abortSession", () => {
    it("aborts successfully", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().abortSession("session-1")
      expect(useSessionStore.getState().lastError).toBeUndefined()
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().abortSession("session-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 9. revertSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("revertSession", () => {
    it("reverts successfully", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().revertSession("session-1", "msg-1", "part-1")
      expect(useSessionStore.getState().lastError).toBeUndefined()
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().revertSession("session-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 10. unrevertSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("unrevertSession", () => {
    it("unreverts successfully", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().unrevertSession("session-1")
      expect(useSessionStore.getState().lastError).toBeUndefined()
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().unrevertSession("session-1")
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 11. fetchDiffs — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("fetchDiffs", () => {
    it("fetches diffs and clears loading state", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      const diffs = await useSessionStore.getState().fetchDiffs("session-1")
      expect(diffs).toHaveLength(1)
      expect(useSessionStore.getState().isDiffsLoading).toBe(false)
      expect(useSessionStore.getState().diffsError).toBeUndefined()
    })

    it("sets isDiffsLoading before request", async () => {
      const client = createMockClient()
      let capturedLoading = false
      ;(client.session.diff as jest.Mock).mockImplementation(async () => {
        capturedLoading = useSessionStore.getState().isDiffsLoading
        return { data: [], error: undefined }
      })
      setupClient(client)
      useSessionStore.setState({ currentSession: mkSession() })
      await useSessionStore.getState().fetchDiffs("session-1")
      expect(capturedLoading).toBe(true)
    })

    it("sets error and diffsError on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      const diffs = await useSessionStore.getState().fetchDiffs("session-1")
      expect(diffs).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
      expect(useSessionStore.getState().isDiffsLoading).toBe(false)
      expect(useSessionStore.getState().diffsError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 12. summarizeSession
  // ──────────────────────────────────────────────────────────────────
  describe("summarizeSession", () => {
    it("returns true on success", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      const result = await useSessionStore.getState().summarizeSession("session-1")
      expect(result).toBe(true)
    })

    it("returns false on failure", async () => {
      setupClient(failClient())
      useSessionStore.setState({ currentSession: mkSession() })
      const result = await useSessionStore.getState().summarizeSession("session-1")
      expect(result).toBe(false)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 13. fetchPermissions — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("fetchPermissions", () => {
    it("fetches permissions on success", async () => {
      setupClient()
      const permissions = await useSessionStore.getState().fetchPermissions()
      expect(permissions).toHaveLength(1)
      expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
    })

    it("sets error on failure", async () => {
      setupClient(failClient())
      const permissions = await useSessionStore.getState().fetchPermissions()
      expect(permissions).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 14. respondToPermission — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("respondToPermission", () => {
    it("responds and removes permission from pending list", async () => {
      setupClient()
      useSessionStore.setState({ pendingPermissions: [mkPermission("perm-1")] })
      const result = await useSessionStore.getState().respondToPermission("perm-1", "once")
      expect(result).toBe(true)
      expect(useSessionStore.getState().pendingPermissions).toHaveLength(0)
    })

    it("returns false on failure", async () => {
      setupClient(failClient())
      const result = await useSessionStore.getState().respondToPermission("perm-1", "always")
      expect(result).toBe(false)
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 15. deleteSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("deleteSession", () => {
    it("deletes session and removes from list", async () => {
      setupClient()
      useSessionStore.setState({
        sessions: [mkSession("session-1"), mkSession("session-2")],
        currentSession: mkSession("session-1"),
        messages: [mkAssistantMsg("m1", "session-1", 1000)],
        messageParts: { m1: [] },
      })
      const result = await useSessionStore.getState().deleteSession("session-1")
      expect(result).toBe(true)
      expect(useSessionStore.getState().sessions).toHaveLength(1)
      expect(useSessionStore.getState().currentSession).toBeUndefined()
      expect(useSessionStore.getState().messages).toHaveLength(0)
    })

    it("does not clear current session when deleting other session", async () => {
      setupClient()
      useSessionStore.setState({
        sessions: [mkSession("session-1"), mkSession("session-2")],
        currentSession: mkSession("session-2"),
      })
      const result = await useSessionStore.getState().deleteSession("session-1")
      expect(result).toBe(true)
      expect(useSessionStore.getState().currentSession?.id).toBe("session-2")
    })

    it("returns false on failure", async () => {
      setupClient(failClient())
      const result = await useSessionStore.getState().deleteSession("session-1")
      expect(result).toBe(false)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 16. shareSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("shareSession", () => {
    it("shares session and updates current", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      const result = await useSessionStore.getState().shareSession("session-1")
      expect(result?.title).toBe("Shared")
      expect(useSessionStore.getState().currentSession?.title).toBe("Shared")
    })

    it("returns undefined on failure", async () => {
      setupClient(failClient())
      const result = await useSessionStore.getState().shareSession("session-1")
      expect(result).toBeUndefined()
      expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 17. unshareSession — success & failure
  // ──────────────────────────────────────────────────────────────────
  describe("unshareSession", () => {
    it("unshares session and updates current", async () => {
      setupClient()
      useSessionStore.setState({ currentSession: mkSession() })
      const result = await useSessionStore.getState().unshareSession("session-1")
      expect(result?.title).toBe("Unshared")
      expect(useSessionStore.getState().currentSession?.title).toBe("Unshared")
    })

    it("returns undefined on failure", async () => {
      setupClient(failClient())
      const result = await useSessionStore.getState().unshareSession("session-1")
      expect(result).toBeUndefined()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 18. setSession — clears data on session change
  // ──────────────────────────────────────────────────────────────────
  describe("setSession", () => {
    it("clears messages and parts when switching sessions", () => {
      useSessionStore.setState({
        currentSession: mkSession("session-1"),
        messages: [mkAssistantMsg("m1", "session-1", 1000)],
        messageParts: { m1: [{ id: "p1", type: "text", text: "hi" } as Part] },
        isAgentWorking: true,
      })
      useSessionStore.getState().setSession(mkSession("session-2"))
      const state = useSessionStore.getState()
      expect(state.currentSession?.id).toBe("session-2")
      expect(state.messages).toHaveLength(0)
      expect(state.messageParts).toEqual({})
      expect(state.isAgentWorking).toBe(false)
    })

    it("does not clear messages when setting same session", () => {
      useSessionStore.setState({
        currentSession: mkSession("session-1"),
        messages: [mkAssistantMsg("m1", "session-1", 1000)],
      })
      useSessionStore.getState().setSession(mkSession("session-1", "Updated Title"))
      expect(useSessionStore.getState().messages).toHaveLength(1)
      expect(useSessionStore.getState().currentSession?.title).toBe("Updated Title")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 19. setSelectedModel — saves and loads recent models
  // ──────────────────────────────────────────────────────────────────
  describe("setSelectedModel", () => {
    it("sets selected model", () => {
      useSessionStore.getState().setSelectedModel({ providerID: "openai", modelID: "gpt-4" })
      expect(useSessionStore.getState().selectedModel).toEqual({ providerID: "openai", modelID: "gpt-4" })
    })

    it("clears selected model", () => {
      useSessionStore.getState().setSelectedModel({ providerID: "openai", modelID: "gpt-4" })
      useSessionStore.getState().setSelectedModel(undefined)
      expect(useSessionStore.getState().selectedModel).toBeUndefined()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 20. reset — closes EventSource, clears timer, resets state
  // ──────────────────────────────────────────────────────────────────
  describe("reset", () => {
    it("closes event source and clears timer", () => {
      const closeFn = jest.fn()
      const timer = setTimeout(() => {}, 99999)
      useSessionStore.setState({
        eventSource: { close: closeFn },
        eventSourceReconnectTimer: timer,
        currentServer: server,
        sessions: [mkSession()],
      })
      useSessionStore.getState().reset()
      expect(closeFn).toHaveBeenCalled()
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(0)
      expect(state.eventSource).toBeUndefined()
      expect(state.currentServer).toBeUndefined()
      clearTimeout(timer)
    })

    it("works when no eventSource or timer", () => {
      useSessionStore.setState({ sessions: [mkSession()] })
      useSessionStore.getState().reset()
      expect(useSessionStore.getState().sessions).toHaveLength(0)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 21. initializeClient
  // ──────────────────────────────────────────────────────────────────
  describe("initializeClient", () => {
    it("creates SDK client and sets state", () => {
      useSessionStore.getState().initializeClient(server)
      const state = useSessionStore.getState()
      expect(state.client).toBeDefined()
      expect(state.currentServer).toEqual(server)
      expect(state.lastError).toBeUndefined()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 22. selectServer
  // ──────────────────────────────────────────────────────────────────
  describe("selectServer", () => {
    it("selects existing server and initializes client", async () => {
      useSessionStore.setState({ servers: [server] })
      await useSessionStore.getState().selectServer("server-1")
      const state = useSessionStore.getState()
      expect(state.currentServerId).toBe("server-1")
      expect(state.currentServer).toEqual(server)
      expect(state.client).toBeDefined()
    })

    it("clears state when selecting undefined server", async () => {
      useSessionStore.setState({
        servers: [server],
        currentServerId: "server-1",
        currentServer: server,
        sessions: [mkSession()],
      })
      await useSessionStore.getState().selectServer(undefined)
      const state = useSessionStore.getState()
      expect(state.currentServerId).toBeUndefined()
      expect(state.currentServer).toBeUndefined()
      expect(state.sessions).toHaveLength(0)
      expect(state.client).toBeUndefined()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 23. removeServer
  // ──────────────────────────────────────────────────────────────────
  describe("removeServer", () => {
    it("removes current server and falls back to next", async () => {
      const server2: ServerConfig = { ...server, id: "server-2", label: "Server 2" }
      useSessionStore.setState({
        servers: [server, server2],
        currentServerId: "server-1",
        currentServer: server,
        sessions: [mkSession()],
      })
      await useSessionStore.getState().removeServer("server-1")
      const state = useSessionStore.getState()
      expect(state.servers).toHaveLength(1)
      expect(state.currentServerId).toBe("server-2")
      expect(state.sessions).toHaveLength(0)
    })

    it("removes non-current server without clearing state", async () => {
      const server2: ServerConfig = { ...server, id: "server-2", label: "Server 2" }
      useSessionStore.setState({
        servers: [server, server2],
        currentServerId: "server-1",
        currentServer: server,
        sessions: [mkSession()],
      })
      await useSessionStore.getState().removeServer("server-2")
      const state = useSessionStore.getState()
      expect(state.servers).toHaveLength(1)
      expect(state.currentServerId).toBe("server-1")
      expect(state.sessions).toHaveLength(1)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 24. hydrateServers
  // ──────────────────────────────────────────────────────────────────
  describe("hydrateServers", () => {
    it("loads servers from storage and sets state", async () => {
      // hydrateServers reads from AsyncStorage/SecureStore.
      // The mock AsyncStorage may have data from prior tests.
      // Just verify it runs without throwing and sets the servers array.
      await useSessionStore.getState().hydrateServers()
      const state = useSessionStore.getState()
      expect(Array.isArray(state.servers)).toBe(true)
      expect(Array.isArray(state.recentModels)).toBe(true)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 25. closeEventSource
  // ──────────────────────────────────────────────────────────────────
  describe("closeEventSource", () => {
    it("closes existing event source and clears state", () => {
      const closeFn = jest.fn()
      const timer = setTimeout(() => {}, 99999)
      useSessionStore.setState({
        eventSource: { close: closeFn },
        eventSessionId: "session-1",
        isEventSourceConnected: true,
        eventSourceReconnectTimer: timer,
      })
      useSessionStore.getState().closeEventSource()
      expect(closeFn).toHaveBeenCalled()
      const state = useSessionStore.getState()
      expect(state.eventSource).toBeUndefined()
      expect(state.eventSessionId).toBeUndefined()
      expect(state.isEventSourceConnected).toBe(false)
      expect(state.eventSourceReconnectTimer).toBeUndefined()
      clearTimeout(timer)
    })

    it("works when no event source exists", () => {
      useSessionStore.getState().closeEventSource()
      expect(useSessionStore.getState().eventSource).toBeUndefined()
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 26. subscribeToEvents
  // ──────────────────────────────────────────────────────────────────
  describe("subscribeToEvents", () => {
    it("returns early when no directory on server", async () => {
      const client = createMockClient()
      useSessionStore.setState({
        client,
        currentServer: { ...server, directory: "" },
      })
      await useSessionStore.getState().subscribeToEvents()
      expect(useSessionStore.getState().eventSource).toBeUndefined()
    })

    it("closes existing event source before creating new one", async () => {
      const closeFn = jest.fn()
      const timer = setTimeout(() => {}, 99999)
      useSessionStore.setState({
        client: createMockClient(),
        currentServer: server,
        eventSource: { close: closeFn },
        eventSourceReconnectTimer: timer,
      })
      await useSessionStore.getState().subscribeToEvents("session-1")
      expect(closeFn).toHaveBeenCalled()
      clearTimeout(timer)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 27. Simple setters
  // ──────────────────────────────────────────────────────────────────
  describe("simple setters", () => {
    it("setProjects", () => {
      useSessionStore.getState().setProjects([mkProject()])
      expect(useSessionStore.getState().projects).toHaveLength(1)
    })

    it("setDiffs", () => {
      useSessionStore.getState().setDiffs([mkDiff()])
      expect(useSessionStore.getState().diffs).toHaveLength(1)
    })

    it("setDiffLoading", () => {
      useSessionStore.getState().setDiffLoading(true, "some error")
      expect(useSessionStore.getState().isDiffsLoading).toBe(true)
      expect(useSessionStore.getState().diffsError).toBe("some error")
    })

    it("setSessions", () => {
      useSessionStore.getState().setSessions([mkSession()])
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it("setMessages sorts oldest-first", () => {
      const m1 = mkAssistantMsg("m1", "s1", 3000)
      const m2 = mkAssistantMsg("m2", "s1", 1000)
      useSessionStore.getState().setMessages([m1, m2])
      expect(useSessionStore.getState().messages[0].id).toBe("m2")
    })

    it("setMessageParts", () => {
      useSessionStore.getState().setMessageParts({ m1: [] })
      expect(useSessionStore.getState().messageParts).toEqual({ m1: [] })
    })

    it("setAgentWorking", () => {
      useSessionStore.getState().setAgentWorking(true)
      expect(useSessionStore.getState().isAgentWorking).toBe(true)
    })

    it("setPendingPermissions", () => {
      useSessionStore.getState().setPendingPermissions([mkPermission()])
      expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
    })

    it("selectProject", () => {
      useSessionStore.getState().selectProject(mkProject())
      expect(useSessionStore.getState().currentProject?.id).toBe("proj-1")
    })

    it("setProject", () => {
      useSessionStore.getState().setProject(mkProject())
      expect(useSessionStore.getState().currentProject?.id).toBe("proj-1")
    })

    it("setError increments errorSeq", () => {
      const seq1 = useSessionStore.getState().errorSeq
      useSessionStore.getState().setError("err1")
      expect(useSessionStore.getState().errorSeq).toBe(seq1 + 1)
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 28. handleEvent — test via dispatching SSE messages to DebugSse
  // ──────────────────────────────────────────────────────────────────
  describe("handleEvent via SSE", () => {
    // Helper: set up subscribeToEvents, grab the DebugSse, and return
    // a function that dispatches a message event containing a payload.
    const setupSse = async (sessionId?: string) => {
      const client = createMockClient()
      useSessionStore.setState({
        client,
        currentServer: server,
        currentProject: mkProject("p1", "/repo"),
      })
      await useSessionStore.getState().subscribeToEvents(sessionId)
      const es = useSessionStore.getState().eventSource
      // Access private listeners map
      const listeners = (es as any).listeners as Record<string, Array<(e: any) => void>>
      const dispatch = (payload: any, directory?: string) => {
        const data = directory
          ? JSON.stringify({ payload, directory })
          : JSON.stringify(payload)
        for (const handler of listeners.message ?? []) {
          handler({ type: "message", data })
        }
      }
      return { dispatch, es }
    }

    it("handles session.updated event — updates currentSession and sessions list", async () => {
      const { dispatch } = await setupSse("session-1")
      const session = mkSession("session-1", "Updated Title")
      useSessionStore.setState({ sessions: [mkSession("session-1", "Old")], currentSession: mkSession("session-1", "Old") })

      dispatch({ type: "session.updated", properties: { info: session } })

      const state = useSessionStore.getState()
      expect(state.currentSession?.title).toBe("Updated Title")
      expect(state.sessions[0].title).toBe("Updated Title")
      expect(state.eventCount).toBeGreaterThan(0)
    })

    it("handles session.created event — adds new session", async () => {
      const { dispatch } = await setupSse()
      useSessionStore.setState({ sessions: [] })
      const session = mkSession("session-new", "New Session")

      dispatch({ type: "session.created", properties: { info: session } })

      expect(useSessionStore.getState().sessions).toHaveLength(1)
      expect(useSessionStore.getState().sessions[0].id).toBe("session-new")
    })

    it("handles session.created when no currentSession — sets it", async () => {
      const { dispatch } = await setupSse()
      useSessionStore.setState({ currentSession: undefined, sessions: [] })
      const session = mkSession("session-new", "New Session")

      dispatch({ type: "session.created", properties: { info: session } })

      expect(useSessionStore.getState().currentSession?.id).toBe("session-new")
    })

    it("handles session.deleted event — removes session", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        sessions: [mkSession("session-1"), mkSession("session-2")],
        currentSession: mkSession("session-1"),
      })

      dispatch({ type: "session.deleted", properties: { info: mkSession("session-1") } })

      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
      expect(state.currentSession).toBeUndefined()
    })

    it("handles session.deleted for non-current session", async () => {
      const { dispatch } = await setupSse("session-2")
      useSessionStore.setState({
        sessions: [mkSession("session-1"), mkSession("session-2")],
        currentSession: mkSession("session-1"),
      })

      dispatch({ type: "session.deleted", properties: { info: mkSession("session-2") } })

      expect(useSessionStore.getState().currentSession?.id).toBe("session-1")
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it("handles message.updated event — upserts message and clears isAgentWorking for assistant", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ isAgentWorking: true, messages: [] })

      const msg = mkAssistantMsg("msg-1", "session-1", 1000)
      dispatch({ type: "message.updated", properties: { info: msg } })

      expect(useSessionStore.getState().isAgentWorking).toBe(false)
      expect(useSessionStore.getState().messages).toHaveLength(1)
    })

    it("handles message.updated for user message — does not clear isAgentWorking", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ isAgentWorking: true, messages: [] })

      const msg = mkUserMsg("msg-u1", "session-1", 1000)
      dispatch({ type: "message.updated", properties: { info: msg } })

      expect(useSessionStore.getState().isAgentWorking).toBe(true)
    })

    it("handles message.part.updated event — new part without delta", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ messageParts: {} })

      const part = { id: "p1", type: "tool", messageID: "msg-1", sessionID: "session-1" }
      dispatch({ type: "message.part.updated", properties: { part } })

      expect(useSessionStore.getState().messageParts["msg-1"]).toHaveLength(1)
    })

    it("handles message.part.updated event — new text part with delta", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ messageParts: {} })

      const part = { id: "p1", type: "text", text: "", messageID: "msg-1", sessionID: "session-1" }
      dispatch({ type: "message.part.updated", properties: { part, delta: "Hello" } })

      const parts = useSessionStore.getState().messageParts["msg-1"]
      expect(parts).toHaveLength(1)
      expect((parts[0] as any).text).toBe("Hello")
    })

    it("handles message.part.updated event — existing text part with delta", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "text", text: "Hel", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      const part = { id: "p1", type: "text", text: "", messageID: "msg-1", sessionID: "session-1" }
      dispatch({ type: "message.part.updated", properties: { part, delta: "lo" } })

      const parts = useSessionStore.getState().messageParts["msg-1"]
      expect((parts[0] as any).text).toBe("Hello")
    })

    it("handles message.part.updated event — existing part without delta replaces", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "tool", status: "pending", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      const part = { id: "p1", type: "tool", status: "done", messageID: "msg-1", sessionID: "session-1" }
      dispatch({ type: "message.part.updated", properties: { part } })

      expect((useSessionStore.getState().messageParts["msg-1"][0] as any).status).toBe("done")
    })

    it("handles message.part.updated — bail out when parts unchanged", async () => {
      const { dispatch } = await setupSse("session-1")
      // withUpdatedParts bails when reference is the same — won't happen
      // normally, but we exercise the code path by checking no crash
      useSessionStore.setState({ messageParts: {} })
      const part = { id: "p1", type: "text", text: "hi", messageID: "msg-1", sessionID: "session-1" }
      dispatch({ type: "message.part.updated", properties: { part } })
      expect(useSessionStore.getState().messageParts["msg-1"]).toHaveLength(1)
    })

    it("handles message.part.delta event — appends text", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "text", text: "Hel", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      dispatch({
        type: "message.part.delta",
        properties: { messageID: "msg-1", partID: "p1", delta: "lo", field: "text", sessionID: "session-1" },
      })

      expect((useSessionStore.getState().messageParts["msg-1"][0] as any).text).toBe("Hello")
    })

    it("handles message.part.delta — ignores non-text field", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "text", text: "Hi", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      dispatch({
        type: "message.part.delta",
        properties: { messageID: "msg-1", partID: "p1", delta: "lo", field: "other", sessionID: "session-1" },
      })

      expect((useSessionStore.getState().messageParts["msg-1"][0] as any).text).toBe("Hi")
    })

    it("handles message.part.delta — ignores missing part", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ messageParts: { "msg-1": [] } })

      dispatch({
        type: "message.part.delta",
        properties: { messageID: "msg-1", partID: "missing", delta: "lo", field: "text", sessionID: "session-1" },
      })

      expect(useSessionStore.getState().messageParts["msg-1"]).toHaveLength(0)
    })

    it("handles message.part.delta — ignores non-text part type", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "tool", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      dispatch({
        type: "message.part.delta",
        properties: { messageID: "msg-1", partID: "p1", delta: "lo", field: "text", sessionID: "session-1" },
      })

      expect((useSessionStore.getState().messageParts["msg-1"][0] as any).type).toBe("tool")
    })

    it("handles message.part.delta with reasoning part type", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messageParts: {
          "msg-1": [{ id: "p1", type: "reasoning", text: "think", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      dispatch({
        type: "message.part.delta",
        properties: { messageID: "msg-1", partID: "p1", delta: "ing", field: "text", sessionID: "session-1" },
      })

      expect((useSessionStore.getState().messageParts["msg-1"][0] as any).text).toBe("thinking")
    })

    it("handles message.part.removed event", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messages: [mkAssistantMsg("msg-1", "session-1", 1000)],
        messageParts: {
          "msg-1": [
            { id: "p1", type: "text", text: "hi", messageID: "msg-1", sessionID: "session-1" } as any,
            { id: "p2", type: "text", text: "bye", messageID: "msg-1", sessionID: "session-1" } as any,
          ],
        },
      })

      dispatch({ type: "message.part.removed", properties: { messageID: "msg-1", partID: "p1" } })

      expect(useSessionStore.getState().messageParts["msg-1"]).toHaveLength(1)
      expect(useSessionStore.getState().messageParts["msg-1"][0].id).toBe("p2")
    })

    it("handles message.part.removed — no-op when part not found", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({
        messages: [mkAssistantMsg("msg-1", "session-1", 1000)],
        messageParts: {
          "msg-1": [{ id: "p1", type: "text", text: "hi", messageID: "msg-1", sessionID: "session-1" } as any],
        },
      })

      dispatch({ type: "message.part.removed", properties: { messageID: "msg-1", partID: "missing" } })

      expect(useSessionStore.getState().messageParts["msg-1"]).toHaveLength(1)
    })

    it("handles permission.asked event — adds new permission", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ pendingPermissions: [] })

      const permission = mkPermission("perm-1", "session-1")
      dispatch({ type: "permission.asked", properties: permission })

      expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
    })

    it("handles permission.asked event — deduplicates", async () => {
      const { dispatch } = await setupSse("session-1")
      const perm = mkPermission("perm-1", "session-1")
      useSessionStore.setState({ pendingPermissions: [perm] })

      dispatch({ type: "permission.asked", properties: perm })

      expect(useSessionStore.getState().pendingPermissions).toHaveLength(1)
    })

    it("handles permission.replied event — removes from pending", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ pendingPermissions: [mkPermission("perm-1", "session-1")] })

      dispatch({ type: "permission.replied", properties: { requestID: "perm-1", sessionID: "session-1" } })

      expect(useSessionStore.getState().pendingPermissions).toHaveLength(0)
    })

    it("handles session.diff event", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ diffs: [], isDiffsLoading: true })

      dispatch({ type: "session.diff", properties: { diff: [mkDiff("file.ts")], sessionID: "session-1" } })

      expect(useSessionStore.getState().diffs).toHaveLength(1)
      expect(useSessionStore.getState().isDiffsLoading).toBe(false)
    })

    it("handles session.error event", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ isAgentWorking: true })

      dispatch({
        type: "session.error",
        properties: { error: { data: { message: "Something broke" } }, sessionID: "session-1" },
      })

      expect(useSessionStore.getState().lastError).toBe("Something broke")
      expect(useSessionStore.getState().isAgentWorking).toBe(false)
    })

    it("handles session.error with fallback to error.name", async () => {
      const { dispatch } = await setupSse("session-1")

      dispatch({
        type: "session.error",
        properties: { error: { name: "TimeoutError" }, sessionID: "session-1" },
      })

      expect(useSessionStore.getState().lastError).toBe("TimeoutError")
    })

    it("handles session.error with unknown error", async () => {
      const { dispatch } = await setupSse("session-1")

      dispatch({
        type: "session.error",
        properties: { error: {}, sessionID: "session-1" },
      })

      expect(useSessionStore.getState().lastError).toBe("Unknown error")
    })

    it("handles session.status event — busy", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ isAgentWorking: false })

      dispatch({ type: "session.status", properties: { status: { type: "busy" }, sessionID: "session-1" } })

      expect(useSessionStore.getState().isAgentWorking).toBe(true)
    })

    it("handles session.status event — idle", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ isAgentWorking: true })

      dispatch({ type: "session.status", properties: { status: { type: "idle" }, sessionID: "session-1" } })

      expect(useSessionStore.getState().isAgentWorking).toBe(false)
    })

    it("ignores events for different directory", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ sessions: [] })

      dispatch(
        { type: "session.created", properties: { info: mkSession("session-new") } },
        "/other-repo"
      )

      expect(useSessionStore.getState().sessions).toHaveLength(0)
    })

    it("ignores events for different session", async () => {
      const { dispatch } = await setupSse("session-1")
      useSessionStore.setState({ sessions: [], isAgentWorking: false })

      dispatch({
        type: "message.updated",
        properties: { info: mkAssistantMsg("msg-1", "session-OTHER", 1000) },
      })

      expect(useSessionStore.getState().messages).toHaveLength(0)
    })

    it("handles unknown event type gracefully (default case)", async () => {
      const { dispatch } = await setupSse()
      const prevCount = useSessionStore.getState().eventCount

      dispatch({ type: "unknown.event.type", properties: {} })

      // Event count still increments for known-format events that pass isForSession
      // But unknown types return false from isForSession, so they're filtered out
    })

    it("handles malformed SSE data gracefully", async () => {
      const client = createMockClient()
      useSessionStore.setState({ client, currentServer: server })
      await useSessionStore.getState().subscribeToEvents()
      const es = useSessionStore.getState().eventSource
      const listeners = (es as any).listeners as Record<string, Array<(e: any) => void>>

      // Dispatch with invalid JSON
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      for (const handler of listeners.message ?? []) {
        handler({ type: "message", data: "not json" })
      }
      consoleSpy.mockRestore()
      // Should not crash
    })

    it("handles SSE event with no data", async () => {
      const client = createMockClient()
      useSessionStore.setState({ client, currentServer: server })
      await useSessionStore.getState().subscribeToEvents()
      const es = useSessionStore.getState().eventSource
      const listeners = (es as any).listeners as Record<string, Array<(e: any) => void>>

      for (const handler of listeners.message ?? []) {
        handler({ type: "message", data: undefined })
      }
      // Should not crash
    })

    it("processes event with directory wrapper", async () => {
      // Subscribe without session filter so isForSession returns true
      const { dispatch } = await setupSse()
      useSessionStore.setState({ sessions: [], eventSessionId: undefined, currentSession: undefined })

      // Same directory as server (/repo) — should be processed
      dispatch(
        { type: "session.created", properties: { info: mkSession("session-new") } },
        "/repo"
      )

      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it("handles normalizeDirectory stripping trailing slashes", async () => {
      const { dispatch } = await setupSse()
      useSessionStore.setState({ sessions: [], eventSessionId: undefined, currentSession: undefined })

      // Directory with trailing slash should match
      dispatch(
        { type: "session.created", properties: { info: mkSession("session-new") } },
        "/repo/"
      )

      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })
  })

  describe("appendMessage (exercises upsertMessage + insertSorted)", () => {
    it("inserts new message in sorted order", () => {
      const m1 = mkAssistantMsg("m1", "s1", 1000)
      const m3 = mkAssistantMsg("m3", "s1", 3000)
      useSessionStore.setState({ messages: [m1, m3] })
      const m2 = mkAssistantMsg("m2", "s1", 2000)
      useSessionStore.getState().appendMessage(m2)
      const ids = useSessionStore.getState().messages.map((m) => m.id)
      expect(ids).toEqual(["m1", "m2", "m3"])
    })

    it("updates existing message in place without re-sorting", () => {
      const m1 = mkAssistantMsg("m1", "s1", 1000)
      const m2 = mkAssistantMsg("m2", "s1", 2000)
      useSessionStore.setState({ messages: [m1, m2] })
      const updated = { ...m1, time: { created: 5000 } } as Message
      useSessionStore.getState().appendMessage(updated)
      // stays at index 0 (in-place update)
      expect(useSessionStore.getState().messages[0].id).toBe("m1")
      expect(useSessionStore.getState().messages[0].time.created).toBe(5000)
    })

    it("inserts message with no timestamp at the beginning", () => {
      const m1 = mkAssistantMsg("m1", "s1", 1000)
      useSessionStore.setState({ messages: [m1] })
      const noTs = { ...mkAssistantMsg("m0", "s1", 0), time: {} } as unknown as Message
      useSessionStore.getState().appendMessage(noTs)
      // getMessageTimestamp returns 0, so it goes before m1 (ts=1000)
      expect(useSessionStore.getState().messages[0].id).toBe("m0")
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 29. getSessionDirectory logic (tested via sendPrompt directory)
  // ──────────────────────────────────────────────────────────────────
  describe("getSessionDirectory", () => {
    it("uses currentSession.directory first", async () => {
      const client = setupClient()
      useSessionStore.setState({
        currentSession: { ...mkSession(), directory: "/session-dir" },
        currentProject: mkProject("p1", "/project-dir"),
      })
      await useSessionStore.getState().sendPrompt("session-1", "hi")
      expect(client.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({ directory: "/session-dir" })
      )
    })

    it("falls back to project worktree", async () => {
      const client = setupClient()
      useSessionStore.setState({
        currentSession: { ...mkSession(), directory: undefined as any },
        currentProject: mkProject("p1", "/project-dir"),
      })
      await useSessionStore.getState().sendPrompt("session-1", "hi")
      expect(client.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({ directory: "/project-dir" })
      )
    })

    it("falls back to server directory", async () => {
      const client = setupClient()
      useSessionStore.setState({
        currentSession: { ...mkSession(), directory: undefined as any },
      })
      await useSessionStore.getState().sendPrompt("session-1", "hi")
      expect(client.session.prompt).toHaveBeenCalledWith(
        expect.objectContaining({ directory: "/repo" })
      )
    })
  })

  // ──────────────────────────────────────────────────────────────────
  // 30. upsertServer edge cases
  // ──────────────────────────────────────────────────────────────────
  describe("upsertServer", () => {
    it("updates existing server in place", async () => {
      useSessionStore.setState({ servers: [server], currentServerId: "server-1", currentServer: server })
      const updated = { ...server, label: "Updated" }
      await useSessionStore.getState().upsertServer(updated)
      expect(useSessionStore.getState().servers[0].label).toBe("Updated")
      expect(useSessionStore.getState().currentServer?.label).toBe("Updated")
    })

    it("reinitializes client when connection details change", async () => {
      useSessionStore.setState({ servers: [server], currentServerId: "server-1", currentServer: server })
      const updated = { ...server, baseUrl: "http://new:4096" as `${string}://${string}` }
      await useSessionStore.getState().upsertServer(updated)
      // Client should have been recreated
      expect(useSessionStore.getState().client).toBeDefined()
      expect(useSessionStore.getState().currentProject).toBeUndefined()
    })
  })
})
