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

  it("keeps messages sorted newest-first", () => {
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
      "msg-newer",
      "msg-older",
    ])

    const latestMessage = createAssistantMessage("msg-latest", 3000)

    useSessionStore.getState().appendMessage(latestMessage)
    expect(useSessionStore.getState().messages.map((item) => item.id)).toEqual([
      "msg-latest",
      "msg-newer",
      "msg-older",
    ])

    const updatedOlderMessage = {
      ...olderMessage,
      time: { created: 4000 },
    }

    useSessionStore.getState().appendMessage(updatedOlderMessage)
    expect(useSessionStore.getState().messages.map((item) => item.id)).toEqual([
      "msg-older",
      "msg-latest",
      "msg-newer",
    ])
  })
})
