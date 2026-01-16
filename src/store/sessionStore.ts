import { create } from "zustand"
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
import { createSdkClient } from "../sdk/client"
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
  projects: Project[]
  pendingPermissions: PermissionRequest[]
  isOffline: boolean
  lastError?: string
}

export const initialSessionState: SessionState = {
  servers: [],
  sessions: [],
  messages: [],
  messageParts: {},
  diffs: [],
  isDiffsLoading: false,
  projects: [],
  pendingPermissions: [],
  isOffline: false,
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

  setPendingPermissions: (permissions: PermissionRequest[]) => void
  setOffline: (isOffline: boolean) => void
  setError: (error?: string) => void
  clearError: () => void
  reset: () => void
  initializeClient: (server: ServerConfig) => void
  fetchProjects: () => Promise<Project[] | undefined>
  selectProject: (project: Project) => void
  fetchSessions: () => Promise<Session[] | undefined>
  createSession: (options?: { title?: string; parentID?: string }) => Promise<
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
  subscribeToEvents: () => Promise<void>
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

  const handleEvent = (event: Event) => {
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
        set((state) => {
          const index = state.messages.findIndex((item) => item.id === message.id)
          if (index === -1) {
            return { messages: [...state.messages, message] }
          }
          const next = [...state.messages]
          next[index] = message
          return { messages: next }
        })
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
    setMessages: (messages) => set({ messages }),
    setMessageParts: (parts) => set({ messageParts: parts }),
    appendMessage: (message) =>
      set((state) => ({ messages: [...state.messages, message] })),
    setDiffs: (diffs) => set({ diffs }),
    setDiffLoading: (isDiffsLoading, diffsError) =>
      set({ isDiffsLoading, diffsError }),
    setProjects: (projects) => set({ projects }),
    setPendingPermissions: (permissions) => set({ pendingPermissions: permissions }),
    setOffline: (isOffline) => set({ isOffline }),
    setError: (error) => set({ lastError: error }),
    clearError: () => set({ lastError: undefined }),
    reset: () => set({ ...initialSessionState }),
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

      const directory = get().currentServer?.directory
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

      const directory = get().currentServer?.directory

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        sessionID: sessionId,
        role: "user",
        time: { created: Date.now() },
        agent: "",
        model: { providerID: "", modelID: "" },
        parts: [{ id: `part-${Date.now()}`, sessionID: sessionId, messageID: `user-${Date.now()}`, type: "text", text }],
      } as Message

      set((state) => ({
        messages: [...state.messages, userMessage],
        lastError: undefined,
      }))

      const parts: TextPartInput[] = [{ type: "text", text }]
      const result = await client.session.prompt({
        sessionID: sessionId,
        directory,
        parts,
      })

      const response = resolveData(result)
      if (!response) {
        set({ lastError: "ERR SERVER UNAVAILABLE" })
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
        set({ messages, messageParts, lastError: undefined })
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
      set({ messages, messageParts, lastError: undefined })
      return messages
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
    subscribeToEvents: async () => {
      const client = ensureClient()
      if (!client) {
        return
      }

      const directory = get().currentServer?.directory
      const streamResult = await client.event.subscribe({ directory })

      for await (const event of streamResult.stream) {
        handleEvent(event)
      }
    },
  }
})
