import React, { useCallback, useEffect, useState } from "react"
import { View, Text, StyleSheet, Pressable, RefreshControl } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import type { CompositeNavigationProp } from "@react-navigation/native"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Project } from "@opencode-ai/sdk/v2/client"
import type { AppTabParamList } from "../navigation/AppTabs"
import { palette } from "../constants/theme"
import { ErrorBanner } from "../components/ErrorBanner"

type ProjectsHomeNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<ProjectsStackParamList>,
  BottomTabNavigationProp<AppTabParamList>
>

export default function ProjectsHomeScreen() {
  const navigation = useNavigation<ProjectsHomeNavigation>()
  const currentServer = useSessionStore((state) => state.currentServer)
  const currentProject = useSessionStore((state) => state.currentProject)
  const projects = useSessionStore((state) => state.projects)
  const servers = useSessionStore((state) => state.servers)
  const fetchProjects = useSessionStore((state) => state.fetchProjects)
  const selectProject = useSessionStore((state) => state.selectProject)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!currentServer) {
      return
    }

    void fetchProjects()
  }, [currentServer, fetchProjects])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProjects()
    setRefreshing(false)
  }, [fetchProjects])

  return (
    <View style={styles.container}>
      <ErrorBanner />
      {servers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.welcomeCard}>
            <Ionicons name="rocket-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
            <Text style={styles.welcomeTitle}>Welcome to OpenCode</Text>
            <Text style={styles.welcomeSubtitle}>
              Connect to your first server to get started.
            </Text>
            <Pressable
              style={styles.welcomeButton}
              onPress={() => navigation.navigate("Settings" as never)}
            >
              <Text style={styles.welcomeButtonText}>Set Up Server</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Settings" as never)}>
              <Text style={styles.welcomeSecondary}>
                Or scan your network to find servers automatically
              </Text>
            </Pressable>
          </View>
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>No projects</Text>
          <Text style={styles.emptyHint}>
            {currentServer ? "No projects found on this server." : "Select a server in Settings."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={projects}
          keyExtractor={(project: Project) => project.id}
          contentContainerStyle={styles.projectList as never}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={palette.smoke[7]}
            />
          }
          renderItem={({ item }: { item: Project }) => {
            const isSelected = item.id === currentProject?.id
            return (
              <Pressable
                onPress={() => {
                  selectProject(item)
                  navigation.navigate("SessionsList")
                }}
                style={[styles.projectItem, isSelected && styles.projectItemActive]}
              >
                <View style={styles.projectInfo}>
                  <Text style={styles.projectName}>
                    {item.name ?? item.worktree.split("/").pop()}
                  </Text>
                  {item.worktree ? (
                    <Text style={styles.projectPath} numberOfLines={1}>
                      {item.worktree}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.smoke[6]} />
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
    backgroundColor: palette.smoke[1],
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: palette.smoke[7],
  },
  emptyHint: {
    fontSize: 13,
    color: palette.smoke[6],
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  welcomeCard: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: palette.smoke[11],
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: palette.smoke[7],
    textAlign: "center",
    marginBottom: 16,
  },
  welcomeButton: {
    width: "100%",
    maxWidth: 280,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: palette.cobalt[9],
    alignItems: "center",
  },
  welcomeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  welcomeSecondary: {
    fontSize: 13,
    color: palette.smoke[7],
    textAlign: "center",
    marginTop: 12,
    textDecorationLine: "underline",
  },
  projectList: {
    padding: 16,
  },
  projectItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.smoke[2],
    marginBottom: 8,
  },
  projectItemActive: {
    backgroundColor: palette.smoke[3],
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.smoke[11],
  },
  projectPath: {
    fontSize: 12,
    color: palette.smoke[7],
    fontFamily: "monospace",
    marginTop: 2,
  },
})
