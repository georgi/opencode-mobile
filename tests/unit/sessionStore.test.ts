import type { FileDiff, Message, OpencodeClient, Session } from "@opencode-ai/sdk/v2/client"
import { useSessionStore } from "../../src/store/sessionStore"

const createSession = (): Session => ({
  id: "session-1",
  slug: "session-1",
  projectID: "project-1",
  directory: "/repo",
  title: "Test Session",
  version: "0.0.0",
  time: {
    created: Date.now(),
    updated: Date.now(),
  },
})

const createMockClient = () => {
  const session = createSession()
  const diffs: FileDiff[] = [
    {
      file: "README.md",
      before: "",
      after: "hello",
      additions: 1,
      deletions: 0,
    },
  ]

  return {
    session: {
      create: jest.fn(async () => ({ data: session })),
      prompt: jest.fn(async () => ({
        data: {
          info: {
            id: "msg-1",
            sessionID: session.id,
            role: "assistant",
            time: {
              created: Date.now(),
            },
            parentID: "root",
            modelID: "model",
            providerID: "provider",
            mode: "chat",
            agent: "build",
            path: {
              cwd: "/repo",
              root: "/repo",
            },
            cost: 0,
            tokens: {
              input: 0,
              output: 0,
              reasoning: 0,
              cache: {
                read: 0,
                write: 0,
              },
            },
          },
          parts: [],
        },
      })),
      diff: jest.fn(async () => ({ data: diffs })),
    },
    permission: {
      list: jest.fn(async () => ({ data: [] })),
      reply: jest.fn(async () => ({ data: true })),
    },
  } as unknown as OpencodeClient
}

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("sets the current server", () => {
    useSessionStore.getState().setServer({
      id: "prod",
      label: "Prod",
      baseUrl: "https://api.opencode.ai",
      directory: "/repo",
      basicAuth: "token",
    })

    expect(useSessionStore.getState().currentServer?.id).toBe("prod")
  })

  it("toggles offline mode", () => {
    useSessionStore.getState().setOffline(true)
    expect(useSessionStore.getState().isOffline).toBe(true)
  })

  it("sets and clears errors", () => {
    useSessionStore.getState().setError("ERR OFFLINE")
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")

    useSessionStore.getState().clearError()
    expect(useSessionStore.getState().lastError).toBeUndefined()
  })

  it("handles offline create session", async () => {
    useSessionStore.getState().setOffline(true)

    const result = await useSessionStore.getState().createSession()

    expect(result).toBeUndefined()
    expect(useSessionStore.getState().lastError).toBe("ERR OFFLINE")
  })

  it("creates session and fetches diffs", async () => {
    const client = createMockClient()

    useSessionStore.setState({
      client,
      currentServer: {
        id: "prod",
        label: "Prod",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo",
        basicAuth: "token",
      },
    })

    const session = await useSessionStore.getState().createSession({
      title: "Test Session",
      directory: "/repo",
    })
    expect(session?.id).toBe("session-1")

    const diffs = await useSessionStore.getState().fetchDiffs("session-1")
    expect(diffs?.length).toBe(1)

    expect(client.session.create).toHaveBeenCalled()
    expect(client.session.diff).toHaveBeenCalledWith({
      sessionID: "session-1",
      directory: "/repo",
    })
  })

  it("keeps messages sorted oldest-first", () => {
    const createAssistantMessage = (id: string, created: number): Message => ({
      id,
      sessionID: "session-1",
      role: "assistant",
      time: { created },
      agent: "",
      modelID: "model",
      providerID: "provider",
      mode: "chat",
      parentID: "root",
      path: {
        cwd: "/repo",
        root: "/repo",
      },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0,
        },
      },
    })

    const olderMessage = createAssistantMessage("msg-older", 1000)
    const newerMessage = createAssistantMessage("msg-newer", 2000)

    useSessionStore.getState().setMessages([olderMessage, newerMessage])
    expect(useSessionStore.getState().messages.map((item) => item.id)).toEqual([
      "msg-older",
      "msg-newer",
    ])

    const latestMessage = createAssistantMessage("msg-latest", 3000)

    useSessionStore.getState().appendMessage(latestMessage)
    expect(useSessionStore.getState().messages.map((item) => item.id)).toEqual([
      "msg-older",
      "msg-newer",
      "msg-latest",
    ])

    // upsertMessage does in-place update (no re-sort) for existing messages
    const updatedOlderMessage = {
      ...olderMessage,
      time: { created: 4000 },
    }

    useSessionStore.getState().appendMessage(updatedOlderMessage)
    // In-place update: msg-older stays at index 0 despite new timestamp
    expect(useSessionStore.getState().messages.map((item) => item.id)).toEqual([
      "msg-older",
      "msg-newer",
      "msg-latest",
    ])
  })

  it("renameSession persists via SDK and updates store on success", async () => {
    const session = createSession()
    const renamed = { ...session, title: "Renamed" }
    const update = jest.fn(async () => ({ data: renamed }))
    const client = { session: { update } } as unknown as OpencodeClient

    useSessionStore.setState({
      client,
      sessions: [session],
      currentSession: session,
      currentServer: {
        id: "prod",
        label: "Prod",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo",
        basicAuth: "",
      },
    })

    const ok = await useSessionStore.getState().renameSession(session.id, "Renamed")

    expect(ok).toBe(true)
    expect(update).toHaveBeenCalledWith({
      sessionID: session.id,
      directory: session.directory,
      title: "Renamed",
    })
    expect(useSessionStore.getState().sessions[0].title).toBe("Renamed")
    expect(useSessionStore.getState().currentSession?.title).toBe("Renamed")
  })

  it("renameSession sends the target session's directory even when a different session is current", async () => {
    const target: Session = {
      ...createSession(),
      id: "session-other",
      directory: "/other-worktree",
      title: "Other",
    }
    const current: Session = {
      ...createSession(),
      id: "session-current",
      directory: "/main-worktree",
      title: "Main",
    }
    const renamed = { ...target, title: "Renamed" }
    const update = jest.fn(async () => ({ data: renamed }))
    const client = { session: { update } } as unknown as OpencodeClient

    useSessionStore.setState({
      client,
      sessions: [current, target],
      currentSession: current,
      currentServer: {
        id: "prod",
        label: "Prod",
        baseUrl: "https://api.opencode.ai",
        directory: "/server-dir",
        basicAuth: "",
      },
    })

    await useSessionStore.getState().renameSession(target.id, "Renamed")

    expect(update).toHaveBeenCalledWith({
      sessionID: target.id,
      directory: target.directory,
      title: "Renamed",
    })
  })

  it("renameSession rolls back the optimistic update on SDK error", async () => {
    const session = createSession()
    const update = jest.fn(async () => {
      throw new Error("boom")
    })
    const client = { session: { update } } as unknown as OpencodeClient

    useSessionStore.setState({
      client,
      sessions: [session],
      currentSession: session,
      currentServer: {
        id: "prod",
        label: "Prod",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo",
        basicAuth: "",
      },
    })

    const ok = await useSessionStore.getState().renameSession(session.id, "Nope")

    expect(ok).toBe(false)
    // Title rolled back to original.
    expect(useSessionStore.getState().sessions[0].title).toBe(session.title)
    expect(useSessionStore.getState().currentSession?.title).toBe(session.title)
    expect(useSessionStore.getState().lastError).toBe("boom")
  })

  it("cancelInflight bumps session scope so in-flight writes are dropped", async () => {
    const before = useSessionStore.getState()._sessionScope
    useSessionStore.getState().cancelInflight()
    expect(useSessionStore.getState()._sessionScope).toBe(before + 1)
    expect(useSessionStore.getState().isAgentWorking).toBe(false)
  })

  it("isProjectsLoading stays true while overlapping fetchProjects calls are in flight", async () => {
    // Block the first call until we release it, then fire a second call so
    // both fetches are concurrently in flight.
    let release: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const list = jest
      .fn()
      .mockImplementationOnce(async () => {
        await blocked
        return { data: [] }
      })
      .mockImplementationOnce(async () => ({ data: [] }))
    const client = { project: { list } } as unknown as OpencodeClient

    useSessionStore.setState({
      client,
      currentServer: {
        id: "prod",
        label: "Prod",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo",
        basicAuth: "",
      },
    })

    const first = useSessionStore.getState().fetchProjects()
    const second = useSessionStore.getState().fetchProjects()

    expect(useSessionStore.getState().isProjectsLoading).toBe(true)
    expect(useSessionStore.getState()._projectsInflight).toBe(2)

    await second
    // The second call resolved synchronously — but the first is still blocked.
    // A naive boolean would already be false here; with the counter it stays true.
    expect(useSessionStore.getState().isProjectsLoading).toBe(true)
    expect(useSessionStore.getState()._projectsInflight).toBe(1)

    release?.()
    await first
    expect(useSessionStore.getState().isProjectsLoading).toBe(false)
    expect(useSessionStore.getState()._projectsInflight).toBe(0)
  })
})
