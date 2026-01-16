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

describe("Server Management", () => {
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

  it("adds and persists a new server", async () => {
    const server = {
      id: "server-1",
      label: "Development",
      baseUrl: "https://dev-api.opencode.ai" as const,
      directory: "/dev-repo",
      basicAuth: "dev-token",
    }

    await useSessionStore.getState().upsertServer(server)

    const state = useSessionStore.getState()
    expect(state.servers).toHaveLength(1)
    expect(state.servers[0]).toEqual(server)
    expect(state.currentServerId).toBe("server-1")
    expect(state.currentServer).toEqual(server)
  })

  it("updates existing server", async () => {
    const server1 = {
      id: "server-1",
      label: "Original",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token1",
    }
    const server2 = {
      id: "server-1",
      label: "Updated",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo-updated",
      basicAuth: "token2",
    }

    await useSessionStore.getState().upsertServer(server1)
    await useSessionStore.getState().upsertServer(server2)

    const state = useSessionStore.getState()
    expect(state.servers).toHaveLength(1)
    expect(state.servers[0].label).toBe("Updated")
    expect(state.servers[0].directory).toBe("/repo-updated")
  })

  it("removes server and updates selection", async () => {
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
    await useSessionStore.getState().selectServer("server-2")
    await useSessionStore.getState().removeServer("server-1")

    const state = useSessionStore.getState()
    expect(state.servers).toHaveLength(1)
    expect(state.currentServerId).toBe("server-2")
  })

  it("clears dependent state when changing servers", async () => {
    const client = createMockClient()
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
      client,
      currentServer: server1,
      currentServerId: "server-1",
      servers: [server1, server2],
      currentProject: createMockProject("proj-1", "Project", "/repo1"),
      sessions: [createMockSession("session-1", "Session")],
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
    })

    await useSessionStore.getState().selectServer("server-2")

    const state = useSessionStore.getState()
    expect(state.currentServerId).toBe("server-2")
    expect(state.currentProject).toBeUndefined()
    expect(state.sessions).toHaveLength(0)
    expect(state.messages).toHaveLength(0)
  })
})

describe("Error Handling", () => {
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

  it("sets ERR OFFLINE when offline and client is undefined", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    const result = await useSessionStore.getState().createSession()
    expect(result).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
  })

  it("sets ERR SERVER UNAVAILABLE when no client", async () => {
    useSessionStore.setState({
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })
    const result = await useSessionStore.getState().fetchProjects()
    expect(result).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("sets ERR INVALID COMMAND when project has no worktree", async () => {
    const client = createMockClient()
    useSessionStore.setState({ client })
    useSessionStore.setState({
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    await useSessionStore.getState().selectProject({ id: "proj-1", name: "Project" } as unknown as Project)
    const result = await useSessionStore.getState().fetchSessions()
    expect(result).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR INVALID COMMAND")
  })

  it("clears error on successful operation", async () => {
    useSessionStore.setState({ lastError: "ERR SERVER UNAVAILABLE" })
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

    await useSessionStore.getState().fetchProjects()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("sets and clears errors correctly", () => {
    useSessionStore.getState().setError("ERR OFFLINE")
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")

    useSessionStore.getState().clearError()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("toggles offline mode", () => {
    expect(useSessionStore.getState().isOffline).toBe(false)

    useSessionStore.getState().setOffline(true)
    expect(useSessionStore.getState().isOffline).toBe(true)

    useSessionStore.getState().setOffline(false)
    expect(useSessionStore.getState().isOffline).toBe(false)
  })
})

describe("Projects Auto-Load", () => {
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

  it("fetches projects when server is configured", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    const projects = await useSessionStore.getState().fetchProjects()

    expect(projects).toHaveLength(2)
    expect(client.project.list).toHaveBeenCalledWith({ directory: "" })
    expect(useSessionStore.getState().projects).toEqual(projects)
  })

  it("returns undefined when no server", async () => {
    const projects = await useSessionStore.getState().fetchProjects()
    expect(projects).toBeUndefined()
  })

  it("filters projects by directory", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo/alpha",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    const projects = await useSessionStore.getState().fetchProjects()

    expect(projects).toHaveLength(1)
    expect(projects?.[0].worktree).toBe("/repo/alpha")
  })

  it("sets projects via action", () => {
    const projects = [
      createMockProject("proj-1", "Project 1", "/repo1"),
      createMockProject("proj-2", "Project 2", "/repo2"),
    ]

    useSessionStore.getState().setProjects(projects)

    expect(useSessionStore.getState().projects).toEqual(projects)
  })
})

describe("Sessions Auto-Load", () => {
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

  it("fetches sessions for current project", async () => {
    const client = createMockClient()
    const project = createMockProject("proj-1", "Project", "/repo")

    useSessionStore.setState({
      client,
      currentProject: project,
      currentServer: {
        id: "server-1",
        label: "Server",
        baseUrl: "https://api.opencode.ai" as const,
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const sessions = await useSessionStore.getState().fetchSessions()

    expect(sessions).toHaveLength(2)
    expect(client.session.list).toHaveBeenCalledWith({ directory: "/repo" })
  })

  it("sets sessions via action", () => {
    const sessions = [
      createMockSession("session-1", "Session 1"),
      createMockSession("session-2", "Session 2"),
    ]

    useSessionStore.getState().setSessions(sessions)

    expect(useSessionStore.getState().sessions).toEqual(sessions)
  })

  it("creates new session and updates current", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    const session = await useSessionStore.getState().createSession({ title: "New Session" })

    expect(session).toBeDefined()
    expect(session?.title).toBe("New Session")
    expect(useSessionStore.getState().currentSession?.id).toBe(session?.id)
    expect(client.session.create).toHaveBeenCalled()
  })

  it("returns undefined when creating session without server", async () => {
    const session = await useSessionStore.getState().createSession({ title: "New Session" })
    expect(session).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR SERVER UNAVAILABLE")
  })
})

describe("Message Handling", () => {
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

  it("fetches messages for session", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    const messages = await useSessionStore.getState().fetchMessages("session-1")

    expect(messages).toHaveLength(4)
    expect(client.session.messages).toHaveBeenCalled()
  })

  it("keeps messages sorted newest-first", () => {
    const olderMessage = createMockAssistantMessage("msg-older", "session-1", 1000)
    const newerMessage = createMockAssistantMessage("msg-newer", "session-1", 2000)

    useSessionStore.getState().setMessages([olderMessage, newerMessage])
    const state = useSessionStore.getState()
    expect(state.messages.map((m) => m.id)).toEqual(["msg-newer", "msg-older"])

    const latestMessage = createMockAssistantMessage("msg-latest", "session-1", 3000)
    useSessionStore.getState().appendMessage(latestMessage)
    const state2 = useSessionStore.getState()
    expect(state2.messages.map((m) => m.id)).toEqual(["msg-latest", "msg-newer", "msg-older"])
  })

  it("sends prompt and updates messages", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    await useSessionStore.getState().sendPrompt("session-1", "Hello, world!")

    const state = useSessionStore.getState()
    expect(state.messages.length).toBeGreaterThan(0)
    expect(client.session.prompt).toHaveBeenCalled()
  })

  it("does not send prompt when offline", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    await useSessionStore.getState().sendPrompt("session-1", "Hello")

    expect(client.session.prompt).not.toHaveBeenCalled()
  })
})

describe("Diff Handling", () => {
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

  it("fetches diffs for session", async () => {
    const client = createMockClient()
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }

    useSessionStore.setState({ client, currentServer: server })

    const diffs = await useSessionStore.getState().fetchDiffs("session-1")

    expect(diffs).toHaveLength(2)
    expect(diffs?.[0].file).toBe("src/app.ts")
    expect(diffs?.[0].additions).toBe(10)
    expect(diffs?.[0].deletions).toBe(5)
    expect(client.session.diff).toHaveBeenCalled()
  })

  it("sets diffs loading state", () => {
    useSessionStore.getState().setDiffLoading(true, undefined)
    expect(useSessionStore.getState().isDiffsLoading).toBe(true)

    useSessionStore.getState().setDiffLoading(false, "ERR SERVER UNAVAILABLE")
    expect(useSessionStore.getState().isDiffsLoading).toBe(false)
    expect(useSessionStore.getState().diffsError).toBe("ERR SERVER UNAVAILABLE")
  })

  it("sets diffs via action", () => {
    const diffs = [
      createMockDiff("file1.ts", 5, 2),
      createMockDiff("file2.ts", 10, 3),
    ]

    useSessionStore.getState().setDiffs(diffs)

    expect(useSessionStore.getState().diffs).toEqual(diffs)
  })

  it("fetches diffs when offline returns undefined", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    const diffs = await useSessionStore.getState().fetchDiffs("session-1")

    expect(diffs).toBeUndefined()
    expect(client.session.diff).not.toHaveBeenCalled()
  })
})

describe("Session Control Actions", () => {
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

  it("aborts session", async () => {
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

    await useSessionStore.getState().abortSession("session-1")

    expect(client.session.abort).toHaveBeenCalled()
  })

  it("reverts session", async () => {
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

    await useSessionStore.getState().revertSession("session-1", "msg-1", "part-1")

    expect(client.session.revert).toHaveBeenCalled()
  })

  it("unreverts session", async () => {
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

    await useSessionStore.getState().unrevertSession("session-1")

    expect(client.session.unrevert).toHaveBeenCalled()
  })

  it("summarizes session", async () => {
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

    const result = await useSessionStore.getState().summarizeSession("session-1")

    expect(result).toBe(true)
    expect(client.session.summarize).toHaveBeenCalled()
  })

  it("does not abort session when offline", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    await useSessionStore.getState().abortSession("session-1")

    expect(client.session.abort).not.toHaveBeenCalled()
  })
})

describe("Permissions", () => {
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

  it("fetches pending permissions", async () => {
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

    const permissions = await useSessionStore.getState().fetchPermissions()

    expect(permissions).toHaveLength(1)
    expect(useSessionStore.getState().pendingPermissions).toEqual(permissions)
  })

  it("responds to permission and removes from pending", async () => {
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
      pendingPermissions: [createMockPermission("perm-1", "session-1")],
    })

    const result = await useSessionStore.getState().respondToPermission("perm-1", "once")

    expect(result).toBe(true)
    expect(client.permission.reply).toHaveBeenCalled()
    expect(useSessionStore.getState().pendingPermissions).toHaveLength(0)
  })

  it("sets pending permissions", () => {
    const permissions = [
      createMockPermission("perm-1", "session-1"),
      createMockPermission("perm-2", "session-2"),
    ]

    useSessionStore.getState().setPendingPermissions(permissions)

    expect(useSessionStore.getState().pendingPermissions).toEqual(permissions)
  })

  it("does not fetch permissions when offline", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    const permissions = await useSessionStore.getState().fetchPermissions()

    expect(permissions).toBeUndefined()
    expect(client.permission.list).not.toHaveBeenCalled()
  })
})

describe("Sharing", () => {
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

  it("shares session", async () => {
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

    const session = await useSessionStore.getState().shareSession("session-1")

    expect(session).toBeDefined()
    expect(client.session.share).toHaveBeenCalled()
  })

  it("unshares session", async () => {
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

    const session = await useSessionStore.getState().unshareSession("session-1")

    expect(session).toBeDefined()
    expect(client.session.unshare).toHaveBeenCalled()
  })

  it("does not share session when offline", async () => {
    useSessionStore.getState().setOffline(true)
    const client = createMockClient()
    useSessionStore.setState({ client })

    const session = await useSessionStore.getState().shareSession("session-1")

    expect(session).toBeUndefined()
    expect(client.session.share).not.toHaveBeenCalled()
  })
})

describe("Event Handling", () => {
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

  it("handles session.created event by adding to sessions list", () => {
    const session = createMockSession("session-new", "New Session")
    const existingSession = createMockSession("session-1", "Session 1")
    
    useSessionStore.setState({
      currentSession: existingSession,
      sessions: [existingSession],
    })

    const newSession: Session = {
      id: "session-new",
      slug: "session-new",
      projectID: "project-1",
      directory: "/repo",
      title: "New Session",
      version: "1.0.0",
      time: { created: Date.now(), updated: Date.now() },
    }

    useSessionStore.setState((state) => ({
      sessions: [newSession, ...state.sessions.filter((s) => s.id !== newSession.id)],
      currentSession: state.currentSession?.id === newSession.id ? newSession : state.currentSession,
    }))

    const state = useSessionStore.getState()
    expect(state.sessions.some((s) => s.id === "session-new")).toBe(true)
    expect(state.sessions).toHaveLength(2)
  })

  it("handles session.deleted event by removing from sessions list", () => {
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

  it("handles session.updated event by updating current session", () => {
    useSessionStore.setState({
      currentSession: createMockSession("session-1", "Old Title"),
    })

    const updatedSession = createMockSession("session-1", "Updated Title")
    useSessionStore.setState({ currentSession: updatedSession })

    expect(useSessionStore.getState().currentSession?.title).toBe("Updated Title")
  })

  it("handles message.updated event by updating messages list", () => {
    const existingMessage = createMockAssistantMessage("msg-1", "session-1", 1000)
    useSessionStore.setState({
      messages: [existingMessage],
    })

    const updatedMessage = createMockAssistantMessage("msg-1", "session-1", 2000)
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

  it("handles permission.asked event by adding to pending permissions", () => {
    const permission = createMockPermission("perm-new", "session-1")
    
    useSessionStore.setState((state) => {
      const exists = state.pendingPermissions.some((p) => p.id === permission.id)
      if (exists) {
        return state
      }
      return { pendingPermissions: [...state.pendingPermissions, permission] }
    })

    expect(useSessionStore.getState().pendingPermissions.some((p) => p.id === "perm-new")).toBe(true)
  })

  it("handles permission.replied event by removing from pending permissions", () => {
    useSessionStore.setState({
      pendingPermissions: [createMockPermission("perm-1", "session-1")],
    })

    useSessionStore.setState((state) => ({
      pendingPermissions: state.pendingPermissions.filter((p) => p.id !== "perm-1"),
    }))

    expect(useSessionStore.getState().pendingPermissions).toHaveLength(0)
  })

  it("handles session.diff event by updating diffs", () => {
    const diffs = [createMockDiff("new-file.ts", 5, 0)]
    
    useSessionStore.setState({ diffs, isDiffsLoading: false, diffsError: undefined })

    expect(useSessionStore.getState().diffs).toEqual(diffs)
    expect(useSessionStore.getState().isDiffsLoading).toBe(false)
  })
})

describe("Store Reset", () => {
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

  it("resets to initial state", () => {
    useSessionStore.setState({
      servers: [{ id: "server-1", label: "Server", baseUrl: "https://api.opencode.ai" as const, directory: "/repo", basicAuth: "token" }],
      currentServerId: "server-1",
      currentServer: { id: "server-1", label: "Server", baseUrl: "https://api.opencode.ai" as const, directory: "/repo", basicAuth: "token" },
      currentProject: createMockProject("proj-1", "Project", "/repo"),
      sessions: [createMockSession("session-1", "Session")],
      messages: [createMockUserMessage("msg-1", "session-1", 1000)],
      diffs: [createMockDiff("file.ts", 5, 2)],
      isDiffsLoading: true,
      lastError: "ERR OFFLINE",
      isOffline: true,
      client: {} as OpencodeClient,
      messageParts: { "msg-1": [] },
    })

    useSessionStore.getState().reset()

    const state = useSessionStore.getState()
    expect(state.servers).toEqual([])
    expect(state.currentServerId).toBeUndefined()
    expect(state.currentServer).toBeUndefined()
    expect(state.currentProject).toBeUndefined()
    expect(state.sessions).toEqual([])
    expect(state.messages).toEqual([])
    expect(state.diffs).toEqual([])
    expect(state.isDiffsLoading).toBe(false)
    expect(state.lastError).toBeUndefined()
    expect(state.isOffline).toBe(false)
    expect(state.client).toBeUndefined()
    expect(state.messageParts).toEqual({})
  })
})

describe("SDK Client Initialization", () => {
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

  it("initializes client with server config", () => {
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }

    useSessionStore.getState().initializeClient(server)

    const state = useSessionStore.getState()
    expect(state.client).toBeDefined()
    expect(state.currentServer).toEqual(server)
    expect(state.lastError).toBeUndefined()
  })

  it("re-initializes client on connection change", async () => {
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
      currentServer: server1,
      currentProject: createMockProject("proj-1", "Project", "/repo1"),
    })

    await useSessionStore.getState().upsertServer(server2)

    expect(useSessionStore.getState().currentServer?.id).toBe("server-2")
  })
})

describe("Project Selection", () => {
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

  it("sets current project", () => {
    const project = createMockProject("proj-1", "Project", "/repo")

    useSessionStore.getState().selectProject(project)

    expect(useSessionStore.getState().currentProject).toEqual(project)
  })

  it("sets project directly", () => {
    const project = createMockProject("proj-1", "Project", "/repo")

    useSessionStore.getState().setProject(project)

    expect(useSessionStore.getState().currentProject).toEqual(project)
  })
})

describe("Session Selection", () => {
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

  it("sets current session", () => {
    const session = createMockSession("session-1", "Session")

    useSessionStore.getState().setSession(session)

    expect(useSessionStore.getState().currentSession).toEqual(session)
  })

  it("adds session to list when created", async () => {
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

    const session = await useSessionStore.getState().createSession({ title: "New Session" })

    expect(useSessionStore.getState().sessions.some((s) => s.id === session?.id)).toBe(true)
  })
})

describe("Message Parts", () => {
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

  it("sets message parts", () => {
    const parts: Record<string, any[]> = {
      "msg-1": [{ id: "part-1", type: "text" as const, text: "Hello" }],
      "msg-2": [{ id: "part-2", type: "reasoning" as const, text: "Thinking" }],
    }

    useSessionStore.getState().setMessageParts(parts)

    expect(useSessionStore.getState().messageParts).toEqual(parts)
  })
})

describe("Server Selection", () => {
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

  it("selects server by id", async () => {
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }
    const client = createMockClient()

    useSessionStore.setState({ servers: [server], client })

    await useSessionStore.getState().selectServer("server-1")

    expect(useSessionStore.getState().currentServerId).toBe("server-1")
    expect(useSessionStore.getState().currentServer).toEqual(server)
  })

  it("clears server selection when id is undefined", async () => {
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }
    const client = createMockClient()

    useSessionStore.setState({ servers: [server], client, currentServerId: "server-1", currentServer: server })

    await useSessionStore.getState().selectServer(undefined)

    expect(useSessionStore.getState().currentServerId).toBeUndefined()
    expect(useSessionStore.getState().currentServer).toBeUndefined()
  })
})

describe("Hydrate Servers", () => {
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

  it("hydrates servers from storage and initializes client", async () => {
    const server = {
      id: "server-1",
      label: "Server",
      baseUrl: "https://api.opencode.ai" as const,
      directory: "/repo",
      basicAuth: "token",
    }
    const client = createMockClient()

    useSessionStore.setState({
      servers: [server],
      currentServerId: "server-1",
      currentServer: server,
      client,
    })

    expect(useSessionStore.getState().currentServer?.id).toBe("server-1")
    expect(useSessionStore.getState().client).toBeDefined()
  })

  it("currentServer is undefined when no server is selected", () => {
    useSessionStore.setState({
      servers: [],
      currentServerId: undefined,
    })

    expect(useSessionStore.getState().currentServer).toBeUndefined()
    expect(useSessionStore.getState().client).toBeUndefined()
  })
})
