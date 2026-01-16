import type { FileDiff, OpencodeClient, Session } from "@opencode-ai/sdk/v2/client"
import { useSessionStore } from "../../src/store/sessionStore"

type PromptResponse = {
  info: {
    id: string
    sessionID: string
    role: "assistant"
    time: { created: number }
    parentID: string
    modelID: string
    providerID: string
    mode: string
    agent: string
    path: { cwd: string; root: string }
    cost: number
    tokens: {
      input: number
      output: number
      reasoning: number
      cache: { read: number; write: number }
    }
  }
  parts: []
}

const createSession = (): Session => ({
  id: "session-42",
  slug: "session-42",
  projectID: "project-1",
  directory: "/repo",
  title: "Integration Session",
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
      file: "src/app.ts",
      before: "",
      after: "console.log('ok')",
      additions: 1,
      deletions: 0,
    },
  ]
  const promptResponse: PromptResponse = {
    info: {
      id: "msg-99",
      sessionID: session.id,
      role: "assistant",
      time: { created: Date.now() },
      parentID: "root",
      modelID: "model",
      providerID: "provider",
      mode: "chat",
      agent: "build",
      path: { cwd: "/repo", root: "/repo" },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    },
    parts: [],
  }

  return {
    session: {
      create: jest.fn(async () => ({ data: session })),
      prompt: jest.fn(async () => ({ data: promptResponse })),
      messages: jest.fn(async () => ({
        data: [
          {
            info: {
              id: "msg-99",
              sessionID: session.id,
              role: "assistant",
              time: { created: Date.now() },
              parentID: "root",
              modelID: "model",
              providerID: "provider",
              mode: "chat",
              agent: "build",
              path: { cwd: "/repo", root: "/repo" },
              cost: 0,
              tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
            },
            parts: [],
          },
        ],
      })),
      diff: jest.fn(async () => ({ data: diffs })),
    },
  } as unknown as OpencodeClient
}

describe("session flow", () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it("creates, prompts, and loads diffs", async () => {
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

    const session = await useSessionStore.getState().createSession()
    expect(session?.id).toBe("session-42")

    await useSessionStore.getState().sendPrompt("session-42", "Hello")
    expect(useSessionStore.getState().messages.length).toBe(1)

    const diffs = await useSessionStore.getState().fetchDiffs("session-42")
    expect(diffs?.[0]?.file).toBe("src/app.ts")
  })
})
