import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  loadServers,
  saveServers,
  deleteServerSecrets,
  loadCurrentServerId,
  saveCurrentServerId,
} from "../../src/storage/serverStorage"

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>

const createServerConfig = (id: string): import("../../src/store/sessionStore").ServerConfig => ({
  id,
  label: `Server ${id}`,
  baseUrl: `https://api.opencode.ai` as const,
  directory: `/repo-${id}`,
  basicAuth: `token-${id}`,
})

describe("serverStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("loadServers", () => {
    it("returns empty array when no stored data", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null)

      const result = await loadServers()

      expect(result).toEqual([])
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("opencode.servers.v1")
    })

    it("returns empty array when version is invalid", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ version: 2, servers: [] }))

      const result = await loadServers()

      expect(result).toEqual([])
    })

    it("returns empty array when servers is not an array", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify({ version: 1, servers: "invalid" }))

      const result = await loadServers()

      expect(result).toEqual([])
    })

    it("loads servers and fetches basicAuth from SecureStore", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          version: 1,
          servers: [
            {
              id: "server-1",
              label: "Server 1",
              baseUrl: "https://api.opencode.ai",
              directory: "/repo1",
              basicAuthKey: "opencode.server.basicAuth.v1.server-1",
            },
            {
              id: "server-2",
              label: "Server 2",
              baseUrl: "https://api.opencode.ai",
              directory: "/repo2",
              basicAuthKey: "opencode.server.basicAuth.v1.server-2",
            },
          ],
        })
      )
      mockSecureStore.getItemAsync
        .mockResolvedValueOnce("token-1")
        .mockResolvedValueOnce("token-2")

      const result = await loadServers()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: "server-1",
        label: "Server 1",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo1",
        basicAuth: "token-1",
      })
      expect(result[1]).toEqual({
        id: "server-2",
        label: "Server 2",
        baseUrl: "https://api.opencode.ai",
        directory: "/repo2",
        basicAuth: "token-2",
      })
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledTimes(2)
    })

    it("uses empty string for missing basicAuth", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify({
          version: 1,
          servers: [
            {
              id: "server-1",
              label: "Server 1",
              baseUrl: "https://api.opencode.ai",
              directory: "/repo1",
              basicAuthKey: "opencode.server.basicAuth.v1.server-1",
            },
          ],
        })
      )
      mockSecureStore.getItemAsync.mockResolvedValue(null)

      const result = await loadServers()

      expect(result[0].basicAuth).toBe("")
    })
  })

  describe("saveServers", () => {
    it("saves servers and basicAuth to storage", async () => {
      const servers = [
        {
          id: "server-1",
          label: "Server 1",
          baseUrl: "https://api.opencode.ai" as const,
          directory: "/repo1",
          basicAuth: "token-1",
        },
        {
          id: "server-2",
          label: "Server 2",
          baseUrl: "https://api.opencode.ai" as const,
          directory: "/repo2",
          basicAuth: "token-2",
        },
      ]

      await saveServers(servers)

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledTimes(2)
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "opencode.server.basicAuth.v1.server-1",
        "token-1"
      )
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "opencode.server.basicAuth.v1.server-2",
        "token-2"
      )
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "opencode.servers.v1",
        JSON.stringify({
          version: 1,
          servers: [
            {
              id: "server-1",
              label: "Server 1",
              baseUrl: "https://api.opencode.ai",
              directory: "/repo1",
              basicAuthKey: "opencode.server.basicAuth.v1.server-1",
            },
            {
              id: "server-2",
              label: "Server 2",
              baseUrl: "https://api.opencode.ai",
              directory: "/repo2",
              basicAuthKey: "opencode.server.basicAuth.v1.server-2",
            },
          ],
        })
      )
    })

    it("saves empty array", async () => {
      await saveServers([])

      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled()
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "opencode.servers.v1",
        JSON.stringify({ version: 1, servers: [] })
      )
    })
  })

  describe("deleteServerSecrets", () => {
    it("deletes server basicAuth from SecureStore", async () => {
      await deleteServerSecrets("server-1")

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "opencode.server.basicAuth.v1.server-1"
      )
    })
  })

  describe("loadCurrentServerId", () => {
    it("returns undefined when no stored value", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null)

      const result = await loadCurrentServerId()

      expect(result).toBeUndefined()
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("opencode.currentServerId.v1")
    })

    it("returns server id when stored", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("server-123")

      const result = await loadCurrentServerId()

      expect(result).toBe("server-123")
    })
  })

  describe("saveCurrentServerId", () => {
    it("saves server id when provided", async () => {
      await saveCurrentServerId("server-123")

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "opencode.currentServerId.v1",
        "server-123"
      )
    })

    it("removes stored value when serverId is undefined", async () => {
      await saveCurrentServerId(undefined)

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("opencode.currentServerId.v1")
    })

    it("removes stored value when serverId is empty string", async () => {
      await saveCurrentServerId("")

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("opencode.currentServerId.v1")
    })
  })
})
