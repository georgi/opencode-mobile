import React, { useEffect, useLayoutEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Pressable,
} from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"

export default function SessionsListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const currentProject = useSessionStore((state) => state.currentProject)
  const currentSession = useSessionStore((state) => state.currentSession)
  const sessions = useSessionStore((state) => state.sessions)
  const createSession = useSessionStore((state) => state.createSession)
  const fetchSessions = useSessionStore((state) => state.fetchSessions)
  const setSession = useSessionStore((state) => state.setSession)
  const lastError = useSessionStore((state) => state.lastError)
  const [title, setTitle] = useState("")

  useEffect(() => {
    if (!currentProject) {
      return
    }

    void fetchSessions()
  }, [currentProject, fetchSessions])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: currentProject?.worktree?.replace(/\/$/, "").split("/").pop() ?? "",
    })
  }, [currentProject, navigation])

  const handleCreate = async () => {
    const session = await createSession({ title: title || undefined })
    if (session?.id) {
      navigation.navigate("SessionDetail", { sessionId: session.id })
    }
  }

  const handleSelectSession = (sessionId: string) => {
    const selected = sessions.find((item) => item.id === sessionId)
    if (!selected) {
      return
    }

    setSession(selected)
    navigation.navigate("SessionDetail", { sessionId: selected.id })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sessions</Text>
      {!currentProject ? (
        <Text style={{ color: colors.text.base }}>Select a project to view sessions.</Text>
      ) : sessions.length === 0 ? (
        <Text style={{ color: colors.text.base }}>No sessions loaded</Text>
      ) : (
        <FlashList
          data={sessions}
          keyExtractor={(session: Session) => session.id}
          contentContainerStyle={styles.sessionList as never}
          renderItem={({ item }: { item: Session }) => {
            const isSelected = item.id === currentSession?.id
            return (
              <Pressable
                onPress={() => handleSelectSession(item.id)}
                style={[styles.sessionItem, isSelected && styles.sessionItemActive]}
              >
                <Text style={styles.sessionTitle}>{item.title}</Text>
              </Pressable>
            )
          }}
        />
      )}
      <Text style={styles.label}>Create Session</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Session title"
      />
      <Pressable onPress={() => void handleCreate()} style={styles.button}>
        <Text style={styles.buttonText}>Start Session</Text>
      </Pressable>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Text style={styles.label}>Current Session</Text>
      <Text style={{ color: colors.text.base }}>{currentSession?.title ?? "No session selected"}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
    backgroundColor: colors.background.base,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
    color: colors.text.weak,
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
  error: {
    color: colors.status.error,
  },
  sessionList: {
    gap: 8,
  },
  sessionItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
  },
  sessionItemActive: {
    backgroundColor: palette.cobalt[2],
    borderColor: palette.cobalt[5],
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.base,
  },
  sessionMeta: {
    fontSize: 12,
    color: colors.text.weak,
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.interactive.base,
    alignItems: "center",
  },
  buttonText: {
    color: colors.text.invert,
    fontWeight: "600",
  },
})
