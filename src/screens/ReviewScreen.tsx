import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Platform } from "react-native"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import * as Diff from "diff"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { FileDiff } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"

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
                const lineColor = part.added ? colors.diff.add : part.removed ? colors.diff.delete : colors.text.weak
                const bgColor = part.added ? colors.diff.addBg : part.removed ? colors.diff.deleteBg : "transparent"

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
                    <ActivityIndicator size="large" color={colors.interactive.base} />
                    <Text style={styles.loadingText}>Loading diffs...</Text>
                </View>
            ) : diffsError ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{diffsError}</Text>
                    {sessionId ? (
                        <Pressable style={styles.button} onPress={() => void fetchDiffs(sessionId)}>
                            <Text style={styles.buttonText}>Retry</Text>
                        </Pressable>
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
        backgroundColor: colors.background.base,
    },
    title: {
        fontSize: 20,
        fontWeight: "600",
        color: colors.text.base,
    },
    loadingState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: colors.text.weak,
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    emptyStateText: {
        fontSize: 14,
        color: colors.text.weak,
    },
    fileList: {
        flex: 1,
    },
    accordionItem: {
        backgroundColor: colors.surface.base,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.surface.highlight,
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
        color: colors.text.weaker,
        width: 16,
    },
    accordionFilename: {
        fontSize: 14,
        fontWeight: "500",
        color: colors.text.base,
    },
    accordionStats: {
        flexDirection: "row",
        gap: 12,
    },
    diffStatAdded: {
        fontSize: 14,
        color: colors.diff.add,
        fontWeight: "500",
    },
    diffStatRemoved: {
        fontSize: 14,
        color: colors.diff.delete,
        fontWeight: "500",
    },
    accordionContent: {
        borderTopWidth: 1,
        borderTopColor: colors.surface.highlight,
    },
    diffScrollView: {
        maxHeight: undefined,
    },
    diffContainer: {
        padding: 8,
    },
    diffLine: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    diffLinePrefix: {
        width: 20,
        alignItems: "center",
        paddingTop: 0,
    },
    diffPrefix: {
        fontSize: 11,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        lineHeight: 16,
        opacity: 0.7,
        width: 12,
        textAlign: "center",
    },
    diffLineText: {
        flex: 1,
        fontSize: 11,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        lineHeight: 16,
        paddingTop: 0,
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
        color: colors.text.weak,
    },
    diffToggleIcon: {
        fontSize: 8,
        color: colors.text.weak,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: colors.interactive.base,
        alignItems: "center",
    },
    buttonText: {
        color: colors.text.invert,
        fontWeight: "600",
    },
})
