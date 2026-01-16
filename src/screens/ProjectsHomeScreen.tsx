import React, { useState } from "react"
import { View, Text, StyleSheet, TextInput, Button, Pressable } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"

const defaultBaseUrl = "https://api.opencode.ai"

export default function ProjectsHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
  const currentServer = useSessionStore((state) => state.currentServer)
  const currentProject = useSessionStore((state) => state.currentProject)
  const projects = useSessionStore((state) => state.projects)
  const initializeClient = useSessionStore((state) => state.initializeClient)
  const fetchProjects = useSessionStore((state) => state.fetchProjects)
  const selectProject = useSessionStore((state) => state.selectProject)
  const setError = useSessionStore((state) => state.setError)
  const lastError = useSessionStore((state) => state.lastError)

  const [label, setLabel] = useState(currentServer?.label ?? "Prod")
  const [baseUrl, setBaseUrl] = useState<string>(
    currentServer?.baseUrl ?? defaultBaseUrl
  )
  const [directory, setDirectory] = useState(
    currentServer?.directory ?? "/Users/you/dev/project"
  )
  const [basicAuth, setBasicAuth] = useState("")

  const handleConnect = () => {
    if (!baseUrl.trim() || !directory.trim()) {
      setError("ERR INVALID COMMAND")
      return
    }

    initializeClient({
      id: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      baseUrl: baseUrl as `${string}://${string}`,
      directory,
      basicAuth,
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Projects</Text>
      <Text>Recent projects and server picker go here.</Text>
      <Text style={styles.label}>Server Picker</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Server label"
      />
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="Base URL"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={directory}
        onChangeText={setDirectory}
        placeholder="Directory"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={basicAuth}
        onChangeText={setBasicAuth}
        placeholder="Basic auth token"
        autoCapitalize="none"
        secureTextEntry
      />
      <Button title="Connect" onPress={handleConnect} />
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Text style={styles.label}>Current Server</Text>
      <Text>{currentServer?.label ?? "No server selected"}</Text>
      <Text style={styles.label}>Projects</Text>
      <Button title="Load Projects" onPress={() => void fetchProjects()} />
      {projects.length === 0 ? (
        <Text>No projects loaded</Text>
      ) : (
        <View style={styles.projectList}>
          {projects.map((project) => {
            const isSelected = project.id === currentProject?.id
            return (
              <Pressable
                key={project.id}
                onPress={() => {
                  selectProject(project)
                  navigation.navigate("SessionsList")
                }}
                style={[styles.projectItem, isSelected && styles.projectItemActive]}
              >
                <Text style={styles.projectName}>
                  {project.name ?? project.worktree}
                </Text>
                <Text style={styles.projectPath}>{project.worktree}</Text>
              </Pressable>
            )
          })}
        </View>
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
  error: {
    color: "#D92D20",
  },
  projectList: {
    gap: 8,
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
