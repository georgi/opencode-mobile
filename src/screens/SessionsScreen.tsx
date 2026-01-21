import React, { useEffect } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"

export default function SessionsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const currentProject = useSessionStore((state) => state.currentProject)
  const currentSession = useSessionStore((state) => state.currentSession)
  const sessions = useSessionStore((state) => state.sessions)
  const fetchSessions = useSessionStore((state) => state.fetchSessions)
  const setSession = useSessionStore((state) => state.setSession)

  useEffect(() => {
    if (!currentProject) {
      return
    }

    void fetchSessions()
  }, [currentProject, fetchSessions])

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
      <Text style={styles.title}>Sessions</Text>
      <Text>Quick access to recent sessions.</Text>

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
          // estimatedItemSize={72}
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
})
