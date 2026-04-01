import React, { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { palette } from "../constants/theme"
import { ErrorBanner } from "../components/ErrorBanner"

function relativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export default function SessionsListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const insets = useSafeAreaInsets()
  const currentProject = useSessionStore((state) => state.currentProject)
  const currentSession = useSessionStore((state) => state.currentSession)
  const sessions = useSessionStore((state) => state.sessions)
  const createSession = useSessionStore((state) => state.createSession)
  const fetchSessions = useSessionStore((state) => state.fetchSessions)
  const setSession = useSessionStore((state) => state.setSession)
  const [refreshing, setRefreshing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!currentProject) {
      return
    }

    void fetchSessions()
  }, [currentProject, fetchSessions])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchSessions()
    setRefreshing(false)
  }, [fetchSessions])

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const sessionDirectory =
        currentProject?.sandboxes?.find((sandbox) => sandbox !== currentProject?.worktree) ??
        currentProject?.worktree
      const session = await createSession({ directory: sessionDirectory })
      if (session?.id) {
        navigation.navigate("SessionDetail", { sessionId: session.id })
      }
    } finally {
      setIsCreating(false)
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

  const projectName =
    currentProject?.name ??
    currentProject?.worktree?.replace(/\/$/, "").split("/").pop() ??
    "Sessions"

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={palette.smoke[11]} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {projectName}
          </Text>
        </View>
      </View>

      <ErrorBanner />

      {!currentProject ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Select a project to view sessions.</Text>
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to start your first conversation.</Text>
        </View>
      ) : (
        <FlashList
          data={sessions}
          keyExtractor={(session: Session) => session.id}
          contentContainerStyle={styles.sessionList as never}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={palette.smoke[7]}
            />
          }
          renderItem={({ item }: { item: Session }) => {
            const isActive = item.id === currentSession?.id
            return (
            <Pressable
              onPress={() => handleSelectSession(item.id)}
              style={[styles.sessionItem, isActive && styles.sessionItemActive]}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle} numberOfLines={1}>
                  {item.title || "Untitled session"}
                </Text>
                <Text style={styles.sessionTime}>
                  {relativeTime(item.time.updated)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.smoke[6]} />
            </Pressable>
            )
          }}
        />
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: 20 + insets.bottom }, isCreating && { opacity: 0.5 }]}
        onPress={() => void handleCreate()}
        disabled={isCreating}
      >
        <Ionicons name="add" size={28} color={palette.smoke[1]} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.smoke[1],
  },
  // --- Header ---
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.smoke[3],
    backgroundColor: palette.smoke[1],
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: palette.smoke[11],
    maxWidth: "80%",
  },
  headerButton: {
    padding: 8,
  },
  // --- Content ---
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    color: palette.smoke[7],
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.smoke[6],
    marginTop: 4,
  },
  sessionList: {
    padding: 16,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.smoke[2],
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  sessionItemActive: {
    backgroundColor: palette.smoke[3],
    borderLeftColor: palette.smoke[10],
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: palette.smoke[11],
  },
  sessionTime: {
    fontSize: 12,
    color: palette.smoke[6],
    marginTop: 2,
  },
  // --- FAB ---
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.smoke[10],
    justifyContent: "center",
    alignItems: "center",
  },
})
