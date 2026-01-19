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
          estimatedItemSize={84}
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
                <Text style={styles.projectName}>{item.name ?? item.worktree}</Text>
                <Text style={styles.projectPath}>{item.worktree}</Text>
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
  },
  title: {
    fontSize: 22,
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
  serverSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  serverSelectorLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  serverSelectorChevron: {
    fontSize: 18,
    color: "#71717A",
  },
  error: {
    color: "#D92D20",
  },
  projectList: {
    gap: 8,
    paddingBottom: 12,
  },
  projectItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  projectItemActive: {
    backgroundColor: "#ECFEFF",
    borderColor: "#A5F3FC",
  },
  projectName: {
    fontSize: 16,
    fontWeight: "600",
  },
  projectPath: {
    fontSize: 12,
    color: "#71717A",
  },
})
