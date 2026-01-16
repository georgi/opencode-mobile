import React, { useEffect, useState } from "react"
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
      <Text style={styles.title}>Sessions List</Text>
      <Text>Active sessions for the selected project.</Text>
      <Text style={styles.label}>Project</Text>
      <Text>{currentProject?.name ?? "No project selected"}</Text>
      <Text style={styles.label}>Sessions</Text>
      {!currentProject ? (
        <Text>Select a project to view sessions.</Text>
      ) : sessions.length === 0 ? (
        <Text>No sessions loaded</Text>
      ) : (
        <FlashList
          data={sessions}
          keyExtractor={(session: Session) => session.id}
          contentContainerStyle={styles.sessionList as never}
          estimatedItemSize={72}
          renderItem={({ item }: { item: Session }) => {
            const isSelected = item.id === currentSession?.id
            return (
              <Pressable
                onPress={() => handleSelectSession(item.id)}
                style={[styles.sessionItem, isSelected && styles.sessionItemActive]}
              >
                <Text style={styles.sessionTitle}>{item.title}</Text>
                <Text style={styles.sessionMeta}>{item.version}</Text>
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
      <Button title="Start Session" onPress={() => void handleCreate()} />
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Text style={styles.label}>Current Session</Text>
      <Text>{currentSession?.title ?? "No session selected"}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  error: {
    color: "#D92D20",
  },
  sessionList: {
    gap: 8,
  },
  sessionItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  sessionItemActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sessionMeta: {
    fontSize: 12,
    color: "#71717A",
  },
})
