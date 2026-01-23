import { create } from "zustand"
import "react-native-url-polyfill/auto"
import type {
  Event,
  FileDiff,
  Message,
  OpencodeClient,
  Part,
  PermissionRequest,
  Project,
  Session,
  TextPart,
  TextPartInput,
} from "@opencode-ai/sdk/v2/client"
import type { ProviderListResponse } from "@opencode-ai/sdk/v2/client"
import { createSdkClient } from "../sdk/client"
import { DebugSse } from "../utils/debugSse"
import {
  deleteServerSecrets,
  loadCurrentServerId,
  loadServers,
  saveCurrentServerId,
  saveServers,
} from "../storage/serverStorage"

export type ServerConfig = {
  id: string
  label: string
  baseUrl: `${string}://${string}`
  directory: string
  basicAuth: string
}

export type SessionState = {
  client?: OpencodeClient

  servers: ServerConfig[]
  currentServerId?: string
  currentServer?: ServerConfig

  currentProject?: Project
  currentSession?: Session
  sessions: Session[]
  messages: Message[]
  messageParts: Record<string, Part[]>
  diffs: FileDiff[]
  isDiffsLoading: boolean
  diffsError?: string
  providers: ProviderListResponse["all"]
  selectedModel?: { providerID: string; modelID: string }
  projects: Project[]
  pendingPermissions: PermissionRequest[]
  isOffline: boolean
  lastError?: string
  isAgentWorking: boolean

  // Debug: Event counter
  eventCount: number
  lastEventType: string | undefined

  // EventSource connection
  eventSource?: any
  eventSessionId?: string
}

export const initialSessionState: SessionState = {
  servers: [],
  sessions: [],
  messages: [],
  messageParts: {},
  diffs: [],
  isDiffsLoading: false,
  providers: [],
  projects: [],
  pendingPermissions: [],
  isOffline: false,
  isAgentWorking: false,

  // Debug: Event counter
  eventCount: 0,
  lastEventType: undefined,

  // EventSource connection
  eventSource: undefined,
  eventSessionId: undefined,
}

type SessionActions = {
  hydrateServers: () => Promise<void>

  upsertServer: (server: ServerConfig) => Promise<void>
  removeServer: (serverId: string) => Promise<void>

  selectServer: (serverId?: string) => Promise<void>

  setServer: (server?: ServerConfig) => void
  setProject: (project?: Project) => void
  setSession: (session?: Session) => void
  setSessions: (sessions: Session[]) => void
  setMessages: (messages: Message[]) => void
  setMessageParts: (parts: Record<string, Part[]>) => void
  appendMessage: (message: Message) => void
  setDiffs: (diffs: FileDiff[]) => void
  setDiffLoading: (isDiffsLoading: boolean, diffsError?: string) => void
  setProjects: (projects: Project[]) => void
  setSelectedModel: (model?: { providerID: string; modelID: string }) => void
  setAgentWorking: (isWorking: boolean) => void

  setPendingPermissions: (permissions: PermissionRequest[]) => void
  setOffline: (isOffline: boolean) => void
  setError: (error?: string) => void
  clearError: () => void
  reset: () => void
  initializeClient: (server: ServerConfig) => void
  fetchProjects: () => Promise<Project[] | undefined>
  selectProject: (project: Project) => void
  fetchProviders: () => Promise<ProviderListResponse["all"] | undefined>
  fetchSessions: () => Promise<Session[] | undefined>
  createSession: (options?: { title?: string; parentID?: string; directory?: string }) => Promise<
    Session | undefined
  >
  sendPrompt: (sessionId: string, text: string) => Promise<void>
  fetchMessages: (sessionId: string) => Promise<Message[] | undefined>
  abortSession: (sessionId: string) => Promise<void>
  revertSession: (sessionId: string, messageId?: string, partId?: string) => Promise<void>
  unrevertSession: (sessionId: string) => Promise<void>
  fetchDiffs: (sessionId: string) => Promise<FileDiff[] | undefined>
  summarizeSession: (sessionId: string) => Promise<boolean>
  fetchPermissions: () => Promise<PermissionRequest[] | undefined>
  respondToPermission: (
    requestId: string,
    reply: "once" | "always" | "reject"
  ) => Promise<boolean>
  shareSession: (sessionId: string) => Promise<Session | undefined>
  unshareSession: (sessionId: string) => Promise<Session | undefined>
  subscribeToEvents: (sessionId?: string) => Promise<void>
  closeEventSource: () => void
}

type ResultFields<TData> = {
  data?: TData
  error?: unknown
}

const resolveData = <TData>(result: ResultFields<TData>) => {
  if (result.error) {
    return undefined
  }
  return result.data
}

const getMessageTimestamp = (message: Message) => message.time?.created ?? 0

const sortMessages = (messages: Message[]) =>
  [...messages].sort((a, b) => getMessageTimestamp(b) - getMessageTimestamp(a))

const upsertMessage = (messages: Message[], message: Message) => {
  const index = messages.findIndex((item) => item.id === message.id)
  if (index === -1) {
    return sortMessages([message, ...messages])
  }
  const next = [...messages]
  next[index] = message
  return sortMessages(next)
}

const upsertPart = (parts: Part[], incoming: Part, delta?: string) => {
  const index = parts.findIndex((item) => item.id === incoming.id)
  if (index === -1) {
    if (delta && incoming.type === "text") {
      const textPart = incoming as TextPart
      return [...parts, { ...textPart, text: `${textPart.text ?? ""}${delta}` }]
    }
    return [...parts, incoming]
  }

  const existing = parts[index]
  const next = [...parts]
  if (delta && existing.type === "text") {
    const textPart = existing as TextPart
    next[index] = { ...textPart, text: `${textPart.text ?? ""}${delta}` }
    return next
  }

  next[index] = incoming
  return next
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => {
  const ensureClient = () => {
    const { client, isOffline } = get()

    if (isOffline) {
      set({ lastError: "ERR OFFLINE" })
      return undefined
    }

    if (!client) {
      set({ lastError: "ERR SERVER UNAVAILABLE" })
      return undefined
    }

    return client
  }

  const isForSession = (event: Event, sessionId: string | undefined) => {
    if (!sessionId) return true

    switch (event.type) {
      case "session.status":
      case "session.diff":
      case "session.error":
      case "permission.asked":
      case "permission.replied":
      case "question.asked":
      case "question.replied":
      case "question.rejected":
      case "todo.updated":
        return event.properties.sessionID === sessionId

      case "message.updated":
        return event.properties.info.sessionID === sessionId

      case "message.part.updated":
        return event.properties.part.sessionID === sessionId

      case "message.part.removed": {
        const message = get().messages.find((item) => item.id === event.properties.messageID)
        return message?.sessionID === sessionId
      }

      case "session.updated":
      case "session.created":
      case "session.deleted":
        return event.properties.info.id === sessionId

      default:
        return false
    }
  }

  const normalizeDirectory = (value?: string) => (value ? value.replace(/\/+$/, "") : value)

  const handleEvent = (event: Event, directory?: string) => {
    const currentDirectory = normalizeDirectory(get().currentServer?.directory)
    const eventDirectory = normalizeDirectory(directory)
    if (eventDirectory && currentDirectory && eventDirectory !== currentDirectory) {
      console.log("🧭 Dropped event (directory mismatch)", {
        eventDirectory,
        currentDirectory,
        type: event.type,
      })
      return
    }

    const sessionId = get().eventSessionId ?? get().currentSession?.id
    if (!isForSession(event, sessionId)) {
      console.log("🧭 Dropped event (session mismatch)", {
        sessionId,
        type: event.type,
      })
      return
    }

    // Log to console AND update state
    console.log("🔔 EVENT RECEIVED:", event.type, JSON.stringify(event.properties, null, 2))

    // Update debug counters in state
    set((state) => ({
      eventCount: state.eventCount + 1,
      lastEventType: event.type,
    }))

    // Also log to Alert for visibility
    if (event.type !== "server.connected" && event.type !== "session.status") {
      // Only alert for non-heartbeat events
      console.log("📊 Event counter:", get().eventCount + 1)
    }

    switch (event.type) {
      case "session.updated":
      case "session.created": {
        const session = event.properties.info
        const currentSession = get().currentSession
        if (!currentSession || currentSession.id === session.id) {
          set({ currentSession: session })
        }
        set((state) => ({
          sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        }))
        break
      }
      case "session.deleted": {
        const session = event.properties.info
        set((state) => ({
          sessions: state.sessions.filter((item) => item.id !== session.id),
          currentSession:
            state.currentSession?.id === session.id
              ? undefined
              : state.currentSession,
        }))
        break
      }
      case "message.updated": {
        const message = event.properties.info
        if (message.role === "assistant") {
          set({ isAgentWorking: false })
        }
        set((state) => ({ messages: upsertMessage(state.messages, message) }))
        break
      }
      case "message.part.updated": {
        const { part, delta } = event.properties
        set((state) => {
          const messageID = part.messageID
          const parts = state.messageParts[messageID] ?? []
          return {
            messageParts: {
              ...state.messageParts,
              [messageID]: upsertPart(parts, part, delta),
            },
          }
        })
        break
      }
      case "message.part.removed": {
        const { messageID, partID } = event.properties
        set((state) => ({
          messageParts: {
            ...state.messageParts,
            [messageID]: (state.messageParts[messageID] ?? []).filter(
              (part) => part.id !== partID
            ),
          },
        }))
        break
      }
      case "permission.asked": {
        const permission = event.properties
        set((state) => {
          const exists = state.pendingPermissions.some((item) => item.id === permission.id)
          if (exists) {
            return state
          }
          return { pendingPermissions: [...state.pendingPermissions, permission] }
        })
        break
      }
      case "permission.replied": {
        const requestId = event.properties.requestID
        set((state) => ({
          pendingPermissions: state.pendingPermissions.filter(
            (permission) => permission.id !== requestId
          ),
        }))
        break
      }
      case "session.diff": {
        set({ diffs: event.properties.diff, isDiffsLoading: false, diffsError: undefined })
        break
      }

      default:
        break
    }
  }

  return {
    ...initialSessionState,

    hydrateServers: async () => {
      const servers = await loadServers()
      const currentServerId = await loadCurrentServerId()
      const currentServer = currentServerId
        ? servers.find((server) => server.id === currentServerId)
        : undefined

      set({ servers, currentServerId, currentServer })

      if (currentServer) {
        get().initializeClient(currentServer)
      }
    },

    upsertServer: async (server) => {
      const previousCurrentServer = get().currentServer

      set((state) => {
        const nextServers = state.servers.some((item) => item.id === server.id)
          ? state.servers.map((item) => (item.id === server.id ? server : item))
          : [server, ...state.servers]

        const currentServerId = state.currentServerId ?? server.id
        const currentServer =
          currentServerId === server.id
            ? server
            : state.currentServer ?? state.servers.find((item) => item.id === currentServerId)

        return {
          servers: nextServers,
          currentServerId,
          currentServer,
        }
      })

      const { servers } = get()
      await saveServers(servers)

      const { currentServerId } = get()
      await saveCurrentServerId(currentServerId)

      const nextCurrentServer = get().currentServer
      const didConnectionChange =
        !!previousCurrentServer &&
        !!nextCurrentServer &&
        previousCurrentServer.id === nextCurrentServer.id &&
        (previousCurrentServer.baseUrl !== nextCurrentServer.baseUrl ||
          previousCurrentServer.directory !== nextCurrentServer.directory ||
          previousCurrentServer.basicAuth !== nextCurrentServer.basicAuth)

      if (nextCurrentServer && didConnectionChange) {
        set({
          client: undefined,
          currentProject: undefined,
          currentSession: undefined,
          sessions: [],
          messages: [],
          messageParts: {},
          diffs: [],
          isDiffsLoading: false,
          diffsError: undefined,
          projects: [],
        })

        get().initializeClient(nextCurrentServer)
      }

      if (nextCurrentServer && previousCurrentServer?.id !== nextCurrentServer.id) {
        get().initializeClient(nextCurrentServer)
      }
    },

    removeServer: async (serverId) => {
      const previousCurrentId = get().currentServerId

      set((state) => {
        const nextServers = state.servers.filter((server) => server.id !== serverId)
        const isCurrent = state.currentServerId === serverId
        const nextCurrent = isCurrent ? nextServers[0] : state.currentServer

        return {
          servers: nextServers,
          currentServerId: isCurrent ? nextCurrent?.id : state.currentServerId,
          currentServer: nextCurrent,
          client: isCurrent ? undefined : state.client,
          currentProject: isCurrent ? undefined : state.currentProject,
          currentSession: isCurrent ? undefined : state.currentSession,
          sessions: isCurrent ? [] : state.sessions,
          messages: isCurrent ? [] : state.messages,
          messageParts: isCurrent ? {} : state.messageParts,
          diffs: isCurrent ? [] : state.diffs,
          isDiffsLoading: isCurrent ? false : state.isDiffsLoading,
          diffsError: isCurrent ? undefined : state.diffsError,
          projects: isCurrent ? [] : state.projects,
        }
      })

      await deleteServerSecrets(serverId)
      await saveServers(get().servers)

      const currentServerId = get().currentServerId
      await saveCurrentServerId(currentServerId)

      const currentServer = get().currentServer
      if (previousCurrentId === serverId && currentServer) {
        get().initializeClient(currentServer)
      }
    },

    selectServer: async (serverId) => {
      const next = serverId
        ? get().servers.find((server) => server.id === serverId)
        : undefined

      set({
        currentServerId: next?.id,
        currentServer: next,
        client: undefined,
        currentProject: undefined,
        currentSession: undefined,
        sessions: [],
        messages: [],
        messageParts: {},
        diffs: [],
        isDiffsLoading: false,
        diffsError: undefined,
        projects: [],
      })

      await saveCurrentServerId(next?.id)

      if (next) {
        get().initializeClient(next)
      }
    },

    setServer: (server) => set({ currentServer: server }),
    setProject: (project) => set({ currentProject: project }),
    setSession: (session) => set({ currentSession: session }),
    setSessions: (sessions) => set({ sessions }),
    setMessages: (messages) => set({ messages: sortMessages(messages) }),
    setMessageParts: (parts) => set({ messageParts: parts }),
    appendMessage: (message) =>
      set((state) => ({ messages: upsertMessage(state.messages, message) })),
    setDiffs: (diffs) => set({ diffs }),
    setDiffLoading: (isDiffsLoading, diffsError) =>
      set({ isDiffsLoading, diffsError }),
    setProjects: (projects) => set({ projects }),
    setSelectedModel: (model) => set({ selectedModel: model }),
    setAgentWorking: (isAgentWorking) => set({ isAgentWorking }),
    setPendingPermissions: (permissions) => set({ pendingPermissions: permissions }),
    setOffline: (isOffline) => set({ isOffline }),
    setError: (error) => set({ lastError: error }),
    clearError: () => set({ lastError: undefined }),
    reset: () => {
      // Close EventSource if open
      const es = get().eventSource
      if (es) {
        es.close()
      }

      set({
        ...initialSessionState,
        client: undefined,
        currentServerId: undefined,
        currentServer: undefined,
        currentProject: undefined,
        currentSession: undefined,
        lastError: undefined,
        diffsError: undefined,
        eventSource: undefined,
      })
    },
    initializeClient: (server) => {
      const client = createSdkClient({
        baseUrl: server.baseUrl,
        directory: server.directory,
        basicAuth: server.basicAuth,
      })

      set({ client, currentServer: server, lastError: undefined })
    },
    fetchProjects: async () => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentServer?.directory
      const result = await client.project.list({ directory })
      const projects = resolveData(result)

      if (!projects) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ projects, lastError: undefined })
      return projects
    },
    selectProject: (project) => set({ currentProject: project }),
    fetchProviders: async () => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentProject?.worktree ?? get().currentServer?.directory
      const result = await client.provider.list({ directory })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      const providers = data.all
      const selectedModel = get().selectedModel
      const selectedStillValid =
        selectedModel &&
        providers.some((provider) => provider.id === selectedModel.providerID && provider.models?.[selectedModel.modelID])

      if (!selectedStillValid) {
        const firstProvider = providers.find((provider) => Object.keys(provider.models ?? {}).length > 0)
        const firstModelID = firstProvider ? Object.keys(firstProvider.models ?? {})[0] : undefined
        set({
          selectedModel: firstProvider && firstModelID ? { providerID: firstProvider.id, modelID: firstModelID } : undefined,
        })
      }

      set({ providers, lastError: undefined })
      return providers
    },
    fetchSessions: async () => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const currentProject = get().currentProject
      if (!currentProject?.worktree) {
        set({ lastError: "ERR INVALID COMMAND" })
        return undefined
      }

      const result = await client.session.list({ directory: currentProject.worktree })
      const sessions = resolveData(result)

      if (!sessions) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ sessions, lastError: undefined })
      return sessions
    },
    createSession: async (options) => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = options?.directory ?? get().currentProject?.worktree
      if (!directory) {
        set({ lastError: "ERR INVALID COMMAND" })
        return undefined
      }
      const result = await client.session.create({
        directory,
        title: options?.title,
        parentID: options?.parentID,
      })

      const session = resolveData(result)
      if (!session) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set((state) => ({
        currentSession: session,
        sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        lastError: undefined,
      }))
      return session
    },
    sendPrompt: async (sessionId, text) => {
      const client = ensureClient()
      if (!client) {
        return
      }

      set({ isAgentWorking: true })
      const directory = get().currentServer?.directory
      const selectedModel = get().selectedModel

      const parts: TextPartInput[] = [{ type: "text", text }]
      const result = await client.session.prompt({
        sessionID: sessionId,
        directory,
        model: selectedModel,
        parts,
      })

      const response = resolveData(result)
      if (!response) {
        set({ lastError: "ERR SERVER UNAVAILABLE", isAgentWorking: false })
        return
      }

      const messagesResult = await client.session.messages({ sessionID: sessionId, directory })
      const messagesData = resolveData(messagesResult)

      if (messagesData) {
        const messages = messagesData.map((item) => item.info)
        const messageParts: Record<string, Part[]> = {}
        for (const item of messagesData) {
          messageParts[item.info.id] = item.parts
        }
        const hasAssistantMessage = messagesData.some(item => item.info.role === "assistant")
        set({ messages: sortMessages(messages), messageParts, lastError: undefined, isAgentWorking: !hasAssistantMessage })
      }
    },
    fetchMessages: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentServer?.directory
      const result = await client.session.messages({ sessionID: sessionId, directory })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      const messages = data.map((item) => item.info)
      const messageParts: Record<string, Part[]> = {}
      for (const item of data) {
        messageParts[item.info.id] = item.parts
      }
      const sortedMessages = sortMessages(messages)
      set({ messages: sortedMessages, messageParts, lastError: undefined })
      return sortedMessages
    },
    abortSession: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return
      }

      const directory = get().currentServer?.directory
      const result = await client.session.abort({ sessionID: sessionId, directory })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return
      }

      set({ lastError: undefined })
    },
    revertSession: async (sessionId, messageId, partId) => {
      const client = ensureClient()
      if (!client) {
        return
      }

      const directory = get().currentServer?.directory
      const result = await client.session.revert({
        sessionID: sessionId,
        directory,
        messageID: messageId,
        partID: partId,
      })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return
      }

      set({ lastError: undefined })
    },
    unrevertSession: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return
      }

      const directory = get().currentServer?.directory
      const result = await client.session.unrevert({ sessionID: sessionId, directory })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return
      }

      set({ lastError: undefined })
    },
    fetchDiffs: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      set({ isDiffsLoading: true, diffsError: undefined })

      const directory = get().currentServer?.directory
      const result = await client.session.diff({ sessionID: sessionId, directory })
      const diffs = resolveData(result)

      if (!diffs) {
        set({ lastError: "ERR SERVER UNAVAILABLE", isDiffsLoading: false, diffsError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ diffs, lastError: undefined, isDiffsLoading: false, diffsError: undefined })
      return diffs
    },
    summarizeSession: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return false
      }

      const directory = get().currentServer?.directory
      const result = await client.session.summarize({ sessionID: sessionId, directory })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return false
      }

      set({ lastError: undefined })
      return data
    },
    fetchPermissions: async () => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentServer?.directory
      const result = await client.permission.list({ directory })
      const permissions = resolveData(result)

      if (!permissions) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ pendingPermissions: permissions, lastError: undefined })
      return permissions
    },
    respondToPermission: async (requestId, reply) => {
      const client = ensureClient()
      if (!client) {
        return false
      }

      const directory = get().currentServer?.directory
      const result = await client.permission.reply({
        requestID: requestId,
        directory,
        reply,
      })
      const data = resolveData(result)

      if (!data) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return false
      }

      set((state) => ({
        pendingPermissions: state.pendingPermissions.filter(
          (permission) => permission.id !== requestId
        ),
        lastError: undefined,
      }))

      return data
    },
    shareSession: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentServer?.directory
      const result = await client.session.share({ sessionID: sessionId, directory })
      const session = resolveData(result)

      if (!session) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ currentSession: session, lastError: undefined })
      return session
    },
    unshareSession: async (sessionId) => {
      const client = ensureClient()
      if (!client) {
        return undefined
      }

      const directory = get().currentServer?.directory
      const result = await client.session.unshare({ sessionID: sessionId, directory })
      const session = resolveData(result)

      if (!session) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
        return undefined
      }

      set({ currentSession: session, lastError: undefined })
      return session
    },
    subscribeToEvents: async (sessionId) => {
      console.log("🚀 Starting event subscription with EventSource...")

      const client = ensureClient()
      if (!client) {
        console.error("❌ Event subscription failed: No client")
        return
      }

      // Use the server directory (matches Instance.directory on the server)
      const directory = get().currentServer?.directory
      if (!directory) {
        console.error("❌ Event subscription failed: No directory")
        return
      }

      console.log("📡 Subscribing to events for directory:", directory)

      // Close existing EventSource if any
      const existingSource = get().eventSource
      if (existingSource) {
        console.log("🔌 Closing existing EventSource connection")
        existingSource.close()
      }

      let serverUrl: URL
      try {
        const baseUrl = get().currentServer?.baseUrl
        if (!baseUrl) {
          console.error("❌ Failed to build EventSource URL: missing baseUrl")
          return
        }
        serverUrl = new URL(baseUrl)
        serverUrl.pathname = serverUrl.pathname.replace(/\/+$/, "") + "/global/event"
      } catch (error) {
        console.error("❌ Failed to build EventSource URL", error)
        return
      }

      const headers: Record<string, string> = {}
      const basicAuth = get().currentServer?.basicAuth
      if (basicAuth) {
        headers.Authorization = `Basic ${basicAuth}`
      }

      console.log("📡 EventSource URL:", serverUrl.toString())
      console.log("📡 EventSource headers:", headers)

      // Create new EventSource connection
      let es: DebugSse
      try {
        es = new DebugSse(serverUrl.toString(), {
          timeout: 0,
          debug: true,
          headers,
        })
      } catch (error) {
        console.error("❌ Failed to create DebugSse", error)
        return
      }

      // Store reference to EventSource + session filter
      set({ eventSource: es, eventSessionId: sessionId })

      es.addEventListener("open", (event) => {
        console.log("✅ EventSource connected!", event)
      })

      es.addEventListener("message", (event) => {
        try {
          console.log("📥 EventSource raw:", event.data)
          const data = JSON.parse(event.data)
          const payload = "payload" in data ? data.payload : data
          const eventDirectory = "directory" in data ? data.directory : undefined
          console.log("📨 EventSource message:", payload.type, payload.properties)
          handleEvent(payload as Event, eventDirectory)
        } catch (error) {
          console.error("❌ Failed to parse event:", error, event.data)
        }
      })

      es.addEventListener("error", (event) => {
        console.error("❌ EventSource error:", event)
        if (event.type === "exception") {
          console.error("Exception:", event.error)
        }
      })

      es.addEventListener("close", (event) => {
        console.log("🔌 EventSource closed", event)
      })
    },

    closeEventSource: () => {
      const es = get().eventSource
      if (es) {
        console.log("🔌 Manually closing EventSource connection")
        es.close()
        set({ eventSource: undefined, eventSessionId: undefined })
      }
    },
  }
})
