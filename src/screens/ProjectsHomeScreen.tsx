import React, { useEffect } from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs"
import type { CompositeNavigationProp } from "@react-navigation/native"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { Project } from "@opencode-ai/sdk/v2/client"
import type { AppTabParamList } from "../navigation/AppTabs"
import { colors, palette } from "../constants/theme"

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

  useEffect(() => {
    if (!currentServer) {
      return
    }

    void fetchProjects()
  }, [currentServer, fetchProjects])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Projects</Text>
      <Text>Recent projects and server picker go here.</Text>

      <Text style={styles.label}>Server</Text>
      <Pressable
        style={styles.serverSelector}
        onPress={() => navigation.navigate("Settings")}
      >
        <Text style={styles.serverSelectorLabel}>
          {currentServer?.label ?? "No server selected"}
        </Text>
        <Text style={styles.serverSelectorChevron}>›</Text>
      </Pressable>

      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <Text style={styles.label}>Projects</Text>
      {projects.length === 0 ? (
        <Text>No projects loaded</Text>
      ) : (
        <FlashList
          data={projects}
          keyExtractor={(project: Project) => project.id}
          contentContainerStyle={styles.projectList as never}
          // estimatedItemSize={84}
          renderItem={({ item }: { item: Project }) => {
            const isSelected = item.id === currentProject?.id
            return (
              <Pressable
                onPress={() => {
                  selectProject(item)
                  setTimeout(() => {
                    navigation.navigate("SessionsList")
                  }, 50)
                }}
                style={[styles.projectItem, isSelected && styles.projectItemActive]}
              >
                <Text style={styles.projectName}>{item.name ?? item.worktree.split("/").pop()}</Text>
                {item.name ? (
                  <Text style={styles.projectPath}>{item.worktree}</Text>
                ) : null}
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
    fontSize: 22,
    fontWeight: "600",
    color: colors.text.base,
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
  serverSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.input.border,
    backgroundColor: colors.input.bg,
  },
  serverSelectorLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.base,
  },
  serverSelectorChevron: {
    fontSize: 18,
    color: colors.text.weaker,
  },
  error: {
    color: colors.status.error,
  },
  projectList: {
    gap: 8,
    paddingBottom: 12,
  },
  projectItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface.highlight,
    backgroundColor: colors.surface.base,
  },
  projectItemActive: {
    backgroundColor: palette.cobalt[2],
    borderColor: palette.cobalt[5],
  },
  projectName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.base,
  },
  projectPath: {
    fontSize: 12,
    color: colors.text.weak,
  },
})
