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

type ProjectsHomeNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<ProjectsStackParamList>,
  BottomTabNavigationProp<AppTabParamList>
>

export default function ProjectsHomeScreen() {
  const navigation = useNavigation<ProjectsHomeNavigation>()
  const currentServer = useSessionStore((state) => state.currentServer)
  const currentProject = useSessionStore((state) => state.currentProject)
  const projects = useSessionStore((state) => state.projects)
  const fetchProjects = useSessionStore((state) => state.fetchProjects)
  const selectProject = useSessionStore((state) => state.selectProject)
  const lastError = useSessionStore((state) => state.lastError)
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
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No projects</Text>
        </View>
      ) : (
        <FlashList
          data={projects}
          keyExtractor={(project: Project) => project.id}
          estimatedItemSize={60}
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
  error: {
    color: palette.smoke[11],
    backgroundColor: palette.smoke[3],
    padding: 12,
    margin: 16,
    borderRadius: 8,
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
