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
import { colors, palette } from "../constants/theme"

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
      <Text style={styles.text}>{isOffline ? "Offline" : "Online"}</Text>

      <Text style={styles.label}>Current Server</Text>
      <Text style={styles.text}>{currentServer?.label ?? "No server selected"}</Text>

      <Text style={styles.label}>Saved Servers</Text>
      {servers.length === 0 ? (
        <Text style={styles.text}>No servers saved</Text>
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
        placeholderTextColor={colors.text.weaker}
      />
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="Base URL"
        placeholderTextColor={colors.text.weaker}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={directory}
        onChangeText={setDirectory}
        placeholder="Directory"
        placeholderTextColor={colors.text.weaker}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={basicAuth}
        onChangeText={setBasicAuth}
        placeholder="Basic auth token"
        placeholderTextColor={colors.text.weaker}
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
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
    color: colors.text.weak,
  },
  text: {
    color: colors.text.base,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.input.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text.base,
    backgroundColor: colors.input.bg,
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
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
    gap: 2,
  },
  serverSelectActive: {
    backgroundColor: palette.cobalt[2],
    borderColor: palette.cobalt[5],
  },
  serverLabel: {
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
  editButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
  },
  editText: {
    color: colors.text.base,
    fontWeight: "600",
  },
  deleteButton: {
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.ember[4],
    backgroundColor: palette.ember[2],
  },
  deleteText: {
    color: colors.status.error,
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.interactive.base,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: colors.interactive.hover,
    opacity: 0.5,
  },
  saveText: {
    color: colors.text.invert,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
    alignItems: "center",
  },
  cancelText: {
    color: colors.text.base,
    fontWeight: "600",
  },
})
