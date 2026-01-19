import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, Button, Pressable, ActivityIndicator, ScrollView, Platform } from "react-native"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import * as Diff from "diff"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { FileDiff } from "@opencode-ai/sdk/v2/client"

function DiffViewer({ diff }: { diff: FileDiff }) {
  const [showUnchanged, setShowUnchanged] = useState(false)
  const diffResult = Diff.diffLines(diff.before, diff.after)
  const unchangedCount = diffResult.filter(part => !part.added && !part.removed).length

  const visibleParts = showUnchanged ? diffResult : diffResult.filter(part => part.added || part.removed)

  return (
    <View style={styles.diffContainer}>
      <Pressable onPress={() => setShowUnchanged(!showUnchanged)} style={styles.diffToggle}>
        <Text style={styles.diffToggleText}>
          {showUnchanged ? "Hide" : "Show"} unchanged lines ({unchangedCount})
        </Text>
        <Text style={styles.diffToggleIcon}>{showUnchanged ? "▲" : "▼"}</Text>
      </Pressable>
      {visibleParts.map((part, index) => {
        const linePrefix = part.added ? "+" : part.removed ? "-" : " "
        const lineColor = part.added ? "#4ADE80" : part.removed ? "#F87171" : "#71717A"
        const bgColor = part.added ? "rgba(74, 222, 128, 0.15)" : part.removed ? "rgba(248, 113, 113, 0.15)" : "transparent"

        return (
          <View key={index} style={[styles.diffLine, { backgroundColor: bgColor }]}>
            <View style={styles.diffLinePrefix}>
              <Text style={[styles.diffPrefix, { color: lineColor }]}>{linePrefix}</Text>
            </View>
            <Text style={[styles.diffLineText, { color: lineColor }]}>{part.value}</Text>
          </View>
        )
      })}
    </View>
  )
}

function FileAccordionItem({
  diff,
  isExpanded,
  onToggle,
}: {
  diff: FileDiff
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <View style={styles.accordionItem}>
      <Pressable onPress={onToggle} style={styles.accordionHeader}>
        <View style={styles.accordionHeaderLeft}>
          <Text style={styles.accordionIcon}>{isExpanded ? "▼" : "▶"}</Text>
          <Text style={styles.accordionFilename}>{diff.file}</Text>
        </View>
        <View style={styles.accordionStats}>
          <Text style={styles.diffStatAdded}>+{diff.additions}</Text>
          <Text style={styles.diffStatRemoved}>-{diff.deletions}</Text>
        </View>
      </Pressable>
      {isExpanded ? (
        <View style={styles.accordionContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.diffScrollView}>
            <DiffViewer diff={diff} />
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}

export default function ReviewScreen() {
  const route = useRoute<RouteProp<ProjectsStackParamList, "Review">>()
  const diffs = useSessionStore((state) => state.diffs)
  const isDiffsLoading = useSessionStore((state) => state.isDiffsLoading)
  const diffsError = useSessionStore((state) => state.diffsError)
  const fetchDiffs = useSessionStore((state) => state.fetchDiffs)
  const currentSession = useSessionStore((state) => state.currentSession)
  const sessionId = currentSession?.id ?? route.params?.sessionId
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

  const toggleFile = (file: string) => {
    const newExpanded = new Set(expandedFiles)
    if (newExpanded.has(file)) {
      newExpanded.delete(file)
    } else {
      newExpanded.add(file)
    }
    setExpandedFiles(newExpanded)
  }

  useEffect(() => {
    if (!sessionId) {
      return
    }

    void fetchDiffs(sessionId)
  }, [sessionId, fetchDiffs])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Changes</Text>

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
        <ScrollView style={styles.fileList} showsVerticalScrollIndicator={true}>
          {diffs.map((diff) => (
            <FileAccordionItem
              key={diff.file}
              diff={diff}
              isExpanded={expandedFiles.has(diff.file)}
              onToggle={() => toggleFile(diff.file)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: "#FAFAFA",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#71717A",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#71717A",
  },
  fileList: {
    flex: 1,
  },
  accordionItem: {
    backgroundColor: "white",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  accordionIcon: {
    fontSize: 10,
    color: "#71717A",
    width: 16,
  },
  accordionFilename: {
    fontSize: 14,
    fontWeight: "500",
    color: "#18181B",
  },
  accordionStats: {
    flexDirection: "row",
    gap: 12,
  },
  diffStatAdded: {
    fontSize: 14,
    color: "#16A34A",
    fontWeight: "500",
  },
  diffStatRemoved: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "500",
  },
  accordionContent: {
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
  },
  diffScrollView: {
    maxHeight: undefined,
  },
  diffContainer: {
    padding: 8,
  },
  diffLine: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "flex-start",
  },
  diffLinePrefix: {
    width: 20,
    alignItems: "center",
    paddingTop: 2,
  },
  diffPrefix: {
    fontSize: 10,
    fontWeight: "600",
    width: 12,
    textAlign: "center",
  },
  diffLineText: {
    flex: 1,
    fontSize: 9,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 14,
    paddingTop: 2,
  },
  diffToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 4,
  },
  diffToggleText: {
    fontSize: 10,
    color: "#71717A",
  },
  diffToggleIcon: {
    fontSize: 8,
    color: "#71717A",
  },
})
