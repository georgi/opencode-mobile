import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { ServerConfig } from "../store/sessionStore"

const SERVERS_KEY = "opencode.servers.v1"
const CURRENT_SERVER_ID_KEY = "opencode.currentServerId.v1"
const BASIC_AUTH_KEY_PREFIX = "opencode.server.basicAuth.v1."

type StoredServer = Omit<ServerConfig, "basicAuth"> & {
  basicAuthKey: string
}

type StoredPayload = {
  version: 1
  servers: StoredServer[]
}

const toBasicAuthKey = (serverId: string) => `${BASIC_AUTH_KEY_PREFIX}${serverId}`

export async function loadServers(): Promise<ServerConfig[]> {
  const raw = await AsyncStorage.getItem(SERVERS_KEY)
  if (!raw) {
    return []
  }

  const parsed = JSON.parse(raw) as StoredPayload
  if (parsed.version !== 1 || !Array.isArray(parsed.servers)) {
    return []
  }

  const servers = await Promise.all(
    parsed.servers.map(async (server) => {
      const basicAuth = (await SecureStore.getItemAsync(server.basicAuthKey)) ?? ""
      return {
        id: server.id,
        label: server.label,
        baseUrl: server.baseUrl,
        directory: server.directory,
        basicAuth,
      } satisfies ServerConfig
    })
  )

  return servers
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
  const stored: StoredServer[] = servers.map((server) => ({
    id: server.id,
    label: server.label,
    baseUrl: server.baseUrl,
    directory: server.directory,
    basicAuthKey: toBasicAuthKey(server.id),
  }))

  await Promise.all(
    servers.map((server) =>
      SecureStore.setItemAsync(toBasicAuthKey(server.id), server.basicAuth)
    )
  )

  const payload: StoredPayload = {
    version: 1,
    servers: stored,
  }

  await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(payload))
}

export async function deleteServerSecrets(serverId: string): Promise<void> {
  await SecureStore.deleteItemAsync(toBasicAuthKey(serverId))
}

export async function loadCurrentServerId(): Promise<string | undefined> {
  const id = await AsyncStorage.getItem(CURRENT_SERVER_ID_KEY)
  return id ?? undefined
}

export async function saveCurrentServerId(serverId?: string): Promise<void> {
  if (!serverId) {
    await AsyncStorage.removeItem(CURRENT_SERVER_ID_KEY)
    return
  }

  await AsyncStorage.setItem(CURRENT_SERVER_ID_KEY, serverId)
}
