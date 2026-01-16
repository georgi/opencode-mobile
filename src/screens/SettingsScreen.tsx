import React, { useMemo, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
} from "react-native"
import { useSessionStore, type ServerConfig } from "../store/sessionStore"

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

  const [label, setLabel] = useState("")
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [directory, setDirectory] = useState("")
  const [basicAuth, setBasicAuth] = useState("")

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
      <Text>{isOffline ? "Offline" : "Online"}</Text>

      <Text style={styles.label}>Current Server</Text>
      <Text>{currentServer?.label ?? "No server selected"}</Text>

      <Text style={styles.label}>Saved Servers</Text>
      {servers.length === 0 ? (
        <Text>No servers saved</Text>
      ) : (
        <View style={styles.serverList}>
          {servers.map((server) => {
            const isSelected = server.id === currentServerId
            return (
              <View key={server.id} style={styles.serverRow}>
                <Pressable
                  onPress={() => void selectServer(server.id)}
                  style={[styles.serverSelect, isSelected && styles.serverSelectActive]}
                >
                  <Text style={styles.serverLabel}>{server.label}</Text>
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
                    style={styles.editButton}
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
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>Remove</Text>
                  </Pressable>
                </View>
              </View>

            )
          })}
        </View>
      )}

      <Text style={styles.label}>{editingServerId ? "Update Server" : "Add Server"}</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Label (e.g. Work)"
      />
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="Base URL"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={directory}
        onChangeText={setDirectory}
        placeholder="Directory"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={basicAuth}
        onChangeText={setBasicAuth}
        placeholder="Basic auth token"
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
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  serverList: {
    gap: 8,
  },
  serverRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  serverSelect: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    gap: 2,
  },
  serverSelectActive: {
    backgroundColor: "#ECFEFF",
    borderColor: "#A5F3FC",
  },
  serverLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  serverMeta: {
    fontSize: 12,
    color: "#71717A",
  },
  serverActions: {
    justifyContent: "center",
    gap: 8,
  },
  editButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    backgroundColor: "#FFFFFF",
  },
  editText: {
    color: "#18181B",
    fontWeight: "600",
  },
  deleteButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  deleteText: {
    color: "#B91C1C",
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#18181B",
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#A1A1AA",
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E4",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  cancelText: {
    color: "#18181B",
    fontWeight: "600",
  },
})
