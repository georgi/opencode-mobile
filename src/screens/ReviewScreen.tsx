import React, { useEffect, useMemo, useState } from "react"
import { View, Text, StyleSheet, Button, Pressable, ActivityIndicator } from "react-native"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"

export default function ReviewScreen() {
  const route = useRoute<RouteProp<ProjectsStackParamList, "Review">>()
  const diffs = useSessionStore((state) => state.diffs)
  const isDiffsLoading = useSessionStore((state) => state.isDiffsLoading)
  const diffsError = useSessionStore((state) => state.diffsError)
  const fetchDiffs = useSessionStore((state) => state.fetchDiffs)
  const currentSession = useSessionStore((state) => state.currentSession)
  const sessionId = currentSession?.id ?? route.params?.sessionId
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const selectedDiff = useMemo(() => {
    if (!selectedFile) {
      return diffs[0]
    }

    return diffs.find((diff) => diff.file === selectedFile) ?? diffs[0]
  }, [diffs, selectedFile])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    void fetchDiffs(sessionId)
  }, [sessionId, fetchDiffs])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Changes</Text>
      <Text>Unified diffs and apply action surface here.</Text>

      {isDiffsLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading diffs...</Text>
        </View>
      ) : diffsError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{diffsError}</Text>
          {sessionId ? (
            <Button title="Retry" onPress={() => void fetchDiffs(sessionId)} />
          ) : null}
        </View>
      ) : diffs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No changes</Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Changed Files</Text>
          <Text>{diffs.length} files</Text>
          <View style={styles.jumpList}>
            {diffs.map((diff) => {
              const isSelected = diff.file === selectedDiff?.file
              return (
                <Pressable
                  key={diff.file}
                  onPress={() => setSelectedFile(diff.file)}
                  style={[styles.jumpItem, isSelected && styles.jumpItemActive]}
                >
                  <Text style={styles.jumpText}>{diff.file}</Text>
                </Pressable>
              )
            })}
          </View>
          {selectedDiff ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{selectedDiff.file}</Text>
              <Text>+{selectedDiff.additions} / -{selectedDiff.deletions}</Text>
            </View>
          ) : null}
        </>
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
    fontSize: 20,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 12,
  },
  jumpList: {
    gap: 6,
  },
  jumpItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E4E4E7",
  },
  jumpItemActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  jumpText: {
    fontSize: 14,
  },
  summaryCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F4F4F5",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#71717A",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#71717A",
  },
})
