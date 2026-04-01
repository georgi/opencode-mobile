import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Network from "expo-network"
import { useSessionStore, type ServerConfig } from "../store/sessionStore"
import { colors, palette } from "../constants/theme"
import { PressableScale } from "../components/PressableScale"

type DiscoveredServer = {
  name: string
  host: string
  port: number
  address: string
}

const SCAN_PORTS = [4096, 4097, 4098, 4099, 4100]
const SCAN_CONCURRENCY = 20

async function scanSubnet(
  onFound: (server: DiscoveredServer) => void,
  signal: AbortSignal,
) {
  const ip = await Network.getIpAddressAsync()
  if (!ip) return
  const subnet = ip.split(".").slice(0, 3).join(".")

  const tasks: (() => Promise<void>)[] = []
  for (let i = 1; i <= 254; i++) {
    const host = `${subnet}.${i}`
    for (const port of SCAN_PORTS) {
      tasks.push(() =>
        fetch(`http://${host}:${port}/global/health`, { signal, method: "GET" })
          .then((res) => res.json())
          .then((data) => {
            if (data?.healthy && data?.version) {
              onFound({
                name: `opencode ${data.version}`,
                host,
                port,
                address: host,
              })
            }
          })
          .catch(() => {}),
      )
    }
  }

  let index = 0
  async function next(): Promise<void> {
    while (index < tasks.length) {
      if (signal.aborted) return
      const task = tasks[index++]
      await task()
    }
  }

  const workers = Array.from({ length: SCAN_CONCURRENCY }, () => next())
  await Promise.all(workers)
}

const defaultBaseUrl = "https://api.opencode.ai"

const uuidv4 = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === "x" ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })

export default function SettingsScreen() {
  const servers = useSessionStore((state) => state.servers)
  const currentServerId = useSessionStore((state) => state.currentServerId)
  const isOffline = useSessionStore((state) => state.isOffline)
  const upsertServer = useSessionStore((state) => state.upsertServer)
  const removeServer = useSessionStore((state) => state.removeServer)
  const selectServer = useSessionStore((state) => state.selectServer)

  const currentServer = useMemo(
    () => servers.find((server) => server.id === currentServerId),
    [servers, currentServerId]
  )

  const [editingServerId, setEditingServerId] = useState<string | undefined>(undefined)
  const [isScanning, setIsScanning] = useState(false)
  const [discovered, setDiscovered] = useState<DiscoveredServer[]>([])

  const [label, setLabel] = useState("")
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [baseUrlError, setBaseUrlError] = useState("")
  const [directory, setDirectory] = useState("")
  const [basicAuth, setBasicAuth] = useState("")
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  const scanAbortRef = useRef<AbortController | null>(null)
  const directoryInputRef = useRef<TextInput>(null)

  const addDiscovered = (server: DiscoveredServer) => {
    setDiscovered((prev) => {
      if (prev.some((s) => s.address === server.address && s.port === server.port)) return prev
      return [...prev, server]
    })
  }

  const startScan = () => {
    scanAbortRef.current?.abort()
    setDiscovered([])
    setIsScanning(true)
    const abort = new AbortController()
    scanAbortRef.current = abort
    const timeout = setTimeout(() => abort.abort(), 10000)
    scanSubnet(addDiscovered, abort.signal).finally(() => {
      clearTimeout(timeout)
      setIsScanning(false)
    })
  }

  useEffect(() => {
    return () => scanAbortRef.current?.abort()
  }, [])

  const canSave = label.trim().length > 0 && baseUrl.trim().length > 0 && directory.trim().length > 0

  const handleSave = async () => {
    if (!canSave) {
      return
    }

    const trimmedUrl = baseUrl.trim()
    try {
      const parsed = new URL(trimmedUrl)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setBaseUrlError("URL must start with http:// or https://")
        return
      }
    } catch {
      setBaseUrlError("Invalid URL")
      return
    }
    setBaseUrlError("")

    const id = editingServerId ?? uuidv4()
    const server: ServerConfig = {
      id,
      label: label.trim(),
      baseUrl: trimmedUrl as `${string}://${string}`,
      directory: directory.trim(),
      basicAuth,
    }

    await upsertServer(server)

    setEditingServerId(undefined)
    setLabel("")
    setDirectory("")
    setBasicAuth("")
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Section 1: Connection */}
      <Text style={styles.sectionLabel}>Connection</Text>
      <View style={styles.card}>
        <View style={styles.connectionRow}>
          <View style={[styles.statusDot, isOffline ? styles.statusDotOffline : styles.statusDotOnline]} />
          <Text style={styles.connectionStatus}>{isOffline ? "Offline" : "Online"}</Text>
        </View>
        {currentServer ? (
          <View style={styles.connectionDetail}>
            <Text style={styles.connectionServerName}>{currentServer.label}</Text>
            <Text style={styles.connectionServerUrl}>{currentServer.baseUrl}</Text>
          </View>
        ) : (
          <Text style={styles.connectionNoServer}>No server selected</Text>
        )}
      </View>

      {/* Section 2: Saved Servers */}
      <Text style={styles.sectionLabel}>Saved Servers</Text>
      <View style={styles.card}>
        {servers.length === 0 ? (
          <View style={styles.emptyServers}>
            <Ionicons name="server-outline" size={32} color={palette.smoke[5]} />
            <Text style={styles.emptyServersText}>No servers saved yet</Text>
          </View>
        ) : (
          <View style={styles.serverList}>
            {servers.map((server) => {
              const isActive = server.id === currentServerId
              return (
                <PressableScale
                  key={server.id}
                  onPress={() => void selectServer(server.id)}
                  style={[styles.serverItem, isActive && styles.serverItemActive]}
                >
                  <View style={styles.serverInfo}>
                    <View style={styles.serverLabelRow}>
                      {isActive && <View style={styles.activeDot} />}
                      <Text style={styles.serverName}>{server.label}</Text>
                    </View>
                    <Text style={styles.serverMeta}>{server.baseUrl}</Text>
                    <Text style={styles.serverMeta}>{server.directory}</Text>
                  </View>
                  <View style={styles.serverActions}>
                    <PressableScale
                      hitSlop={8}
                      onPress={() => {
                        setEditingServerId(server.id)
                        setLabel(server.label)
                        setBaseUrl(server.baseUrl)
                        setDirectory(server.directory)
                        setBasicAuth(server.basicAuth)
                      }}
                    >
                      <Ionicons name="pencil" size={18} color={palette.smoke[9]} />
                    </PressableScale>
                    <PressableScale
                      hitSlop={8}
                      onPress={() => {
                        Alert.alert(
                          "Remove server",
                          `Remove ${server.label}?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () => void removeServer(server.id),
                            },
                          ]
                        )
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={palette.ember[9]} />
                    </PressableScale>
                  </View>
                </PressableScale>
              )
            })}
          </View>
        )}
      </View>

      {/* Section 3: Discover on LAN */}
      <Text style={styles.sectionLabel}>Discover on LAN</Text>
      <View style={styles.card}>
        <PressableScale onPress={startScan} disabled={isScanning} style={styles.scanRow}>
          {isScanning ? (
            <ActivityIndicator size="small" color={palette.smoke[7]} />
          ) : (
            <Ionicons name="search" size={18} color={palette.smoke[7]} />
          )}
          <Text style={styles.scanRowText}>{isScanning ? "Scanning..." : "Scan network"}</Text>
        </PressableScale>
        {discovered.length > 0 &&
          discovered.map((server) => (
            <PressableScale
              key={`${server.address}:${server.port}`}
              style={styles.discoveredRow}
              onPress={() => {
                setLabel(server.name.replace("opencode-", "opencode "))
                setBaseUrl(`http://${server.address}:${server.port}`)
                setDirectory("")
                setBasicAuth("")
                setEditingServerId(undefined)
                setTimeout(() => directoryInputRef.current?.focus(), 100)
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.discoveredName}>{server.name}</Text>
                <Text style={styles.discoveredAddress}>{server.address}:{server.port}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={palette.smoke[7]} />
            </PressableScale>
          ))
        }
        {isScanning && discovered.length === 0 && (
          <Text style={styles.scanHint}>Looking for OpenCode servers...</Text>
        )}
      </View>

      {/* Section 4: Add / Edit Server */}
      <Text style={styles.sectionLabel}>{editingServerId ? "Edit Server" : "Add Server"}</Text>
      <View style={styles.card}>
        <TextInput
          style={[styles.input, focusedInput === "label" && styles.inputFocused]}
          value={label}
          onChangeText={setLabel}
          onFocus={() => setFocusedInput("label")}
          onBlur={() => setFocusedInput(null)}
          placeholder="Label (e.g. Work)"
          placeholderTextColor={palette.smoke[7]}
        />
        <TextInput
          style={[styles.input, focusedInput === "baseUrl" && styles.inputFocused]}
          value={baseUrl}
          onChangeText={(text) => {
            setBaseUrl(text)
            if (baseUrlError) setBaseUrlError("")
          }}
          onFocus={() => setFocusedInput("baseUrl")}
          onBlur={() => setFocusedInput(null)}
          placeholder="Base URL"
          placeholderTextColor={palette.smoke[7]}
          autoCapitalize="none"
        />
        {baseUrlError ? <Text style={styles.baseUrlError}>{baseUrlError}</Text> : null}
        <TextInput
          ref={directoryInputRef}
          style={[styles.input, focusedInput === "directory" && styles.inputFocused]}
          value={directory}
          onChangeText={setDirectory}
          onFocus={() => setFocusedInput("directory")}
          onBlur={() => setFocusedInput(null)}
          placeholder="Directory"
          placeholderTextColor={palette.smoke[7]}
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, focusedInput === "basicAuth" && styles.inputFocused]}
          value={basicAuth}
          onChangeText={setBasicAuth}
          onFocus={() => setFocusedInput("basicAuth")}
          onBlur={() => setFocusedInput(null)}
          placeholder="Basic auth token"
          placeholderTextColor={palette.smoke[7]}
          autoCapitalize="none"
          secureTextEntry
        />
        <PressableScale
          onPress={() => void handleSave()}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          disabled={!canSave}
        >
          <Text style={styles.saveText}>{editingServerId ? "Update Server" : "Save Server"}</Text>
        </PressableScale>
      </View>

      {editingServerId ? (
        <PressableScale
          onPress={() => {
            setEditingServerId(undefined)
            setLabel("")
            setBaseUrl(defaultBaseUrl)
            setDirectory("")
            setBasicAuth("")
          }}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancel Edit</Text>
        </PressableScale>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 8,
    backgroundColor: colors.background.base,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 12,
    color: palette.smoke[7],
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: palette.smoke[2],
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  // --- Connection ---
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: palette.apple[9],
  },
  statusDotOffline: {
    backgroundColor: palette.ember[9],
  },
  connectionStatus: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.text.base,
  },
  connectionDetail: {
    gap: 2,
  },
  connectionServerName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.base,
  },
  connectionServerUrl: {
    fontSize: 12,
    color: colors.text.weak,
  },
  connectionNoServer: {
    fontSize: 13,
    color: palette.smoke[6],
  },
  // --- Saved Servers ---
  emptyServers: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptyServersText: {
    fontSize: 13,
    color: palette.smoke[6],
  },
  serverList: {
    gap: 8,
  },
  serverItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: palette.smoke[3],
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  serverItemActive: {
    borderLeftColor: palette.cobalt[9],
  },
  serverInfo: {
    flex: 1,
    gap: 2,
  },
  serverLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.apple[9],
  },
  serverName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.base,
  },
  serverMeta: {
    fontSize: 12,
    color: colors.text.weak,
  },
  serverActions: {
    flexDirection: "row",
    gap: 16,
    paddingLeft: 12,
  },
  // --- Discover ---
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  scanRowText: {
    fontSize: 14,
    color: palette.smoke[9],
    fontWeight: "500",
  },
  discoveredRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: palette.smoke[3],
    gap: 8,
  },
  discoveredName: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.smoke[10],
  },
  discoveredAddress: {
    fontSize: 12,
    fontFamily: "Menlo",
    color: palette.smoke[7],
    marginTop: 2,
  },
  scanHint: {
    fontSize: 13,
    color: palette.smoke[6],
    textAlign: "center",
    paddingVertical: 8,
  },
  // --- Add/Edit Server ---
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.smoke[11],
    backgroundColor: palette.smoke[3],
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputFocused: {
    borderColor: palette.cobalt[9],
  },
  baseUrlError: {
    color: palette.ember[9],
    fontSize: 12,
    marginTop: -6,
  },
  saveButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: palette.smoke[10],
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: palette.smoke[1],
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: palette.smoke[7],
    fontWeight: "600",
  },
})
