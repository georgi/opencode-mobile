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

type DiscoveredServer = {
  name: string
  host: string
  port: number
  address: string
}

let zeroconf: any = null
try {
  const Zeroconf = require("react-native-zeroconf").default
  if (Zeroconf) {
    const instance = new Zeroconf()
    // Verify the native module is actually functional
    if (instance && typeof instance.scan === "function") {
      zeroconf = instance
    }
  }
} catch {
  // native module not available (Expo Go)
}

const SCAN_PORTS = [4096, 4097, 4098, 4099, 4100]

async function scanSubnet(
  onFound: (server: DiscoveredServer) => void,
  signal: AbortSignal,
) {
  const ip = await Network.getIpAddressAsync()
  if (!ip) return
  const subnet = ip.split(".").slice(0, 3).join(".")

  const checks: Promise<void>[] = []
  for (let i = 1; i <= 254; i++) {
    if (signal.aborted) break
    const host = `${subnet}.${i}`
    for (const port of SCAN_PORTS) {
      checks.push(
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
  await Promise.all(checks)
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
  const [directory, setDirectory] = useState("")
  const [basicAuth, setBasicAuth] = useState("")

  const scanAbortRef = useRef<AbortController | null>(null)

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

    if (zeroconf) {
      // mDNS path
      zeroconf.scan("http", "tcp", "local.")
      setTimeout(() => {
        zeroconf.stop()
        setIsScanning(false)
      }, 5000)
    } else {
      // Network scan fallback
      const abort = new AbortController()
      scanAbortRef.current = abort
      const timeout = setTimeout(() => abort.abort(), 10000)
      scanSubnet(addDiscovered, abort.signal).finally(() => {
        clearTimeout(timeout)
        setIsScanning(false)
      })
    }
  }

  useEffect(() => {
    if (!zeroconf) return
    const onResolved = (service: any) => {
      if (!service.name?.startsWith("opencode-")) return
      const address = service.addresses?.[0] ?? service.host
      if (!address) return
      addDiscovered({ name: service.name, host: service.host, port: service.port, address })
    }
    zeroconf.on("resolved", onResolved)
    return () => {
      zeroconf.removeListener("resolved", onResolved)
      zeroconf.stop()
    }
  }, [])

  useEffect(() => {
    return () => scanAbortRef.current?.abort()
  }, [])

  const canSave = label.trim().length > 0 && baseUrl.trim().length > 0 && directory.trim().length > 0

  const handleSave = async () => {
    if (!canSave) {
      return
    }

    const id = editingServerId ?? uuidv4()
    const server: ServerConfig = {
      id,
      label: label.trim(),
      baseUrl: baseUrl.trim() as `${string}://${string}`,
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
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Status</Text>
      <Text style={styles.text}>{isOffline ? "Offline" : "Online"}</Text>

      <Text style={styles.label}>Current Server</Text>
      <Text style={styles.text}>{currentServer?.label ?? "No server selected"}</Text>

      <Text style={styles.label}>Saved Servers</Text>
      {servers.length === 0 ? (
        <Text style={styles.text}>No servers saved</Text>
      ) : (
        <View style={styles.serverList}>
          {servers.map((server) => {
            const isActive = server.id === currentServerId
            return (
              <View key={server.id} style={styles.serverRow}>
                <Pressable
                  onPress={() => void selectServer(server.id)}
                  style={[styles.serverCard, isActive && styles.serverCardActive]}
                >
                  <View style={styles.serverLabelRow}>
                    {isActive && <View style={styles.activeDot} />}
                    <Text style={styles.serverName}>{server.label}</Text>
                  </View>
                  <Text style={styles.serverMeta}>{server.baseUrl}</Text>
                  <Text style={styles.serverMeta}>{server.directory}</Text>
                </Pressable>

                <View style={styles.serverActions}>
                  <Pressable
                    onPress={() => {
                      setEditingServerId(server.id)
                      setLabel(server.label)
                      setBaseUrl(server.baseUrl)
                      setDirectory(server.directory)
                      setBasicAuth(server.basicAuth)
                    }}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>

                  <Pressable
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
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>

            )
          })}
        </View>
      )}

      <View style={styles.scanHeader}>
        <Text style={styles.label}>Discover on LAN</Text>
        <Pressable onPress={startScan} disabled={isScanning} style={styles.scanButton}>
          {isScanning ? (
            <ActivityIndicator size="small" color={palette.smoke[7]} />
          ) : (
            <Ionicons name="search" size={16} color={palette.smoke[7]} />
          )}
          <Text style={styles.scanButtonText}>{isScanning ? "Scanning..." : "Scan"}</Text>
        </Pressable>
      </View>
      {discovered.length > 0 && (
        <View style={styles.discoveredList}>
          {discovered.map((server) => (
            <Pressable
              key={`${server.address}:${server.port}`}
              style={styles.discoveredCard}
              onPress={() => {
                setLabel(server.name.replace("opencode-", "opencode "))
                setBaseUrl(`http://${server.address}:${server.port}`)
                setDirectory("")
                setBasicAuth("")
                setEditingServerId(undefined)
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.discoveredName}>{server.name}</Text>
                <Text style={styles.discoveredAddress}>{server.address}:{server.port}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={palette.smoke[7]} />
            </Pressable>
          ))}
        </View>
      )}
      {isScanning && discovered.length === 0 && (
        <Text style={styles.scanHint}>Looking for OpenCode servers...</Text>
      )}

      <Text style={styles.label}>{editingServerId ? "Update Server" : "Add Server"}</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Label (e.g. Work)"
        placeholderTextColor={palette.smoke[7]}
      />
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="Base URL"
        placeholderTextColor={palette.smoke[7]}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={directory}
        onChangeText={setDirectory}
        placeholder="Directory"
        placeholderTextColor={palette.smoke[7]}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={basicAuth}
        onChangeText={setBasicAuth}
        placeholder="Basic auth token"
        placeholderTextColor={palette.smoke[7]}
        autoCapitalize="none"
        secureTextEntry
      />

      <Pressable
        onPress={() => void handleSave()}
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        disabled={!canSave}
      >
        <Text style={styles.saveText}>{editingServerId ? "Update Server" : "Save Server"}</Text>
      </Pressable>

      {editingServerId ? (
        <Pressable
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
        </Pressable>
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
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text.base,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 12,
    color: palette.smoke[7],
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  text: {
    color: colors.text.base,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: palette.smoke[11],
    backgroundColor: palette.smoke[2],
  },
  serverList: {
    gap: 8,
  },
  serverRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  serverCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.smoke[2],
    gap: 2,
  },
  serverCardActive: {
    backgroundColor: palette.smoke[3],
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
    backgroundColor: palette.smoke[9],
  },
  serverName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.base,
  },
  serverMeta: {
    fontSize: 12,
    color: colors.text.weak,
  },
  serverActions: {
    justifyContent: "center",
    gap: 8,
  },
  editText: {
    color: palette.smoke[9],
    fontWeight: "600",
  },
  removeText: {
    color: palette.ember[9],
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
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
  scanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.smoke[2],
  },
  scanButtonText: {
    fontSize: 13,
    color: palette.smoke[7],
    fontWeight: "500",
  },
  discoveredList: {
    gap: 6,
  },
  discoveredCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.smoke[2],
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
    paddingVertical: 12,
  },
})
