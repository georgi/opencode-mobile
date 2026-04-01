import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native"
import { FlashList } from "@shopify/flash-list"
import { Swipeable } from "react-native-gesture-handler"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { palette } from "../constants/theme"
import { PressableScale } from "../components/PressableScale"
import { ErrorBanner } from "../components/ErrorBanner"
import * as Haptics from "expo-haptics"

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
  const deleteSession = useSessionStore((state) => state.deleteSession)
  const [refreshing, setRefreshing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [sortMode, setSortMode] = useState<"recent" | "az">("recent")

  const filteredSessions = useMemo(() => {
    let result = sessions
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((s) =>
        (s.title || "Untitled session").toLowerCase().includes(query)
      )
    }
    if (sortMode === "az") {
      result = [...result].sort((a, b) =>
        (a.title || "Untitled session").localeCompare(b.title || "Untitled session")
      )
    }
    return result
  }, [sessions, searchQuery, sortMode])

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

  const handleRenameSession = (session: Session) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.prompt(
      "Rename session",
      undefined,
      (newTitle) => {
        if (newTitle?.trim()) {
          const updated = { ...session, title: newTitle.trim() }
          // Optimistic local update
          useSessionStore.setState((state) => ({
            sessions: state.sessions.map((s) => (s.id === session.id ? updated : s)),
            currentSession:
              state.currentSession?.id === session.id ? updated : state.currentSession,
          }))
        }
      },
      "plain-text",
      session.title || ""
    )
  }

  const handleDeleteSession = (session: Session, swipeableRef?: Swipeable | null) => {
    Alert.alert(
      "Delete session",
      `Delete "${session.title || "Untitled session"}"?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => swipeableRef?.close() },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            void deleteSession(session.id)
          },
        },
      ],
      { cancelable: true, onDismiss: () => swipeableRef?.close() }
    )
  }

  const renderRightActions = () => (
    <View style={styles.swipeDeleteContainer}>
      <Ionicons name="trash-outline" size={20} color="#fff" />
    </View>
  )

  const projectName =
    currentProject?.name ??
    currentProject?.worktree?.replace(/\/$/, "").split("/").pop() ??
    "Sessions"

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PressableScale style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={palette.smoke[11]} />
          </PressableScale>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {projectName}
          </Text>
        </View>
      </View>

      <ErrorBanner />

      {sessions.length > 0 && (
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, isSearchFocused && styles.searchContainerFocused, { flex: 1 }]}>
            <Ionicons name="search" size={16} color={palette.smoke[6]} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Search sessions..."
              placeholderTextColor={palette.smoke[6]}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search sessions"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={palette.smoke[6]} />
              </Pressable>
            )}
          </View>
          <PressableScale
            style={styles.sortChip}
            onPress={() => setSortMode((m) => (m === "recent" ? "az" : "recent"))}
            accessibilityLabel="Toggle sort order"
          >
            <Text style={styles.sortChipText}>
              {sortMode === "recent" ? "Recent \u2193" : "A-Z \u2193"}
            </Text>
          </PressableScale>
        </View>
      )}

      {searchQuery.trim().length > 0 && filteredSessions.length > 0 && (
        <Text style={styles.searchCount}>
          {filteredSessions.length} {filteredSessions.length === 1 ? "session" : "sessions"}
        </Text>
      )}

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
      ) : filteredSessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matching sessions</Text>
        </View>
      ) : (
        <FlashList
          data={filteredSessions}
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
            let swipeableRef: Swipeable | null = null
            return (
            <Swipeable
              ref={(ref) => { swipeableRef = ref }}
              renderRightActions={renderRightActions}
              onSwipeableOpen={() => handleDeleteSession(item, swipeableRef)}
              overshootRight={false}
            >
              <PressableScale
                onPress={() => handleSelectSession(item.id)}
                onLongPress={() => handleRenameSession(item)}
                style={[styles.sessionItem, isActive && styles.sessionItemActive]}
                accessibilityLabel={item.title || "Untitled session"}
                accessibilityRole="button"
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
              </PressableScale>
            </Swipeable>
            )
          }}
        />
      )}

      {/* FAB */}
      <PressableScale
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={() => void handleCreate()}
        disabled={isCreating}
        accessibilityLabel="Create new session"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={28} color={palette.smoke[1]} />
      </PressableScale>
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
    padding: 10,
  },
  // --- Search ---
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.smoke[2],
    justifyContent: "center",
    alignItems: "center",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: palette.smoke[9],
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.smoke[2],
    borderWidth: 1,
    borderColor: "transparent",
  },
  searchContainerFocused: {
    borderColor: palette.cobalt[9],
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: palette.smoke[11],
    paddingVertical: 0,
  },
  searchCount: {
    fontSize: 12,
    color: palette.smoke[6],
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
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
  // --- Swipe delete ---
  swipeDeleteContainer: {
    backgroundColor: palette.ember[9],
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
    marginBottom: 8,
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
