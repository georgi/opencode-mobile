import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Text, StyleSheet, Pressable, RefreshControl, Platform, ScrollView } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import * as Diff from "diff"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import type { FileDiff } from "@opencode-ai/sdk/v2/client"
import { colors, palette } from "../constants/theme"
import { PressableScale } from "../components/PressableScale"

function DiffViewer({ diff }: { diff: FileDiff }) {
    const [showUnchanged, setShowUnchanged] = useState(false)
    const diffResult = useMemo(
        () => Diff.diffLines(diff.before, diff.after),
        [diff.before, diff.after]
    )
    const unchangedCount = diffResult.filter(part => !part.added && !part.removed).length

    const visibleParts = showUnchanged ? diffResult : diffResult.filter(part => part.added || part.removed)

    return (
        <View style={styles.diffContainer}>
            <PressableScale onPress={() => setShowUnchanged(!showUnchanged)} style={styles.diffToggle}>
                <Text style={styles.diffToggleText}>
                    {showUnchanged ? "Hide" : "Show"} unchanged lines ({unchangedCount})
                </Text>
                <Text style={styles.diffToggleIcon}>{showUnchanged ? "▲" : "▼"}</Text>
            </PressableScale>
            {visibleParts.map((part, index) => {
                const linePrefix = part.added ? "+" : part.removed ? "-" : " "
                const lineColor = part.added ? palette.mint[12] : part.removed ? palette.ember[12] : colors.text.weak
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
            <PressableScale onPress={onToggle} style={styles.accordionHeader}>
                <View style={styles.accordionHeaderLeft}>
                    <Text style={styles.accordionIcon}>{isExpanded ? "▼" : "▶"}</Text>
                    <Text style={styles.accordionFilename} numberOfLines={1}>{diff.file}</Text>
                </View>
                <View style={styles.accordionStats}>
                    <Text style={styles.diffStatAdded}>+{diff.additions}</Text>
                    <Text style={styles.diffStatRemoved}>-{diff.deletions}</Text>
                </View>
            </PressableScale>
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
    const [refreshing, setRefreshing] = useState(false)

    const toggleFile = (file: string) => {
        const newExpanded = new Set(expandedFiles)
        if (newExpanded.has(file)) {
            newExpanded.delete(file)
        } else {
            newExpanded.add(file)
        }
        setExpandedFiles(newExpanded)
    }

    const expandAll = () => {
        setExpandedFiles(new Set(diffs.map((d) => d.file)))
    }

    const collapseAll = () => {
        setExpandedFiles(new Set())
    }

    const allExpanded = diffs.length > 0 && expandedFiles.size === diffs.length

    const summary = useMemo(() => {
        const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0)
        const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0)
        return { fileCount: diffs.length, totalAdditions, totalDeletions }
    }, [diffs])

    useEffect(() => {
        if (!sessionId) {
            return
        }

        void fetchDiffs(sessionId)
    }, [sessionId, fetchDiffs])

    const onRefresh = useCallback(async () => {
        if (!sessionId) return
        setRefreshing(true)
        await fetchDiffs(sessionId)
        setRefreshing(false)
    }, [sessionId, fetchDiffs])

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Review Changes</Text>

            {isDiffsLoading ? (
                <View style={styles.loadingState}>
                    <View style={styles.skeletonCard} />
                    <View style={styles.skeletonCard} />
                    <View style={styles.skeletonCard} />
                    <Text style={styles.loadingText}>Loading diffs...</Text>
                </View>
            ) : diffsError ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{diffsError}</Text>
                    {sessionId ? (
                        <PressableScale style={styles.button} onPress={() => void fetchDiffs(sessionId)}>
                            <Text style={styles.buttonText}>Retry</Text>
                        </PressableScale>
                    ) : null}
                </View>
            ) : diffs.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="checkmark-done-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyStateText}>No changes</Text>
                    <Text style={styles.emptyStateHint}>This session hasn't modified any files yet.</Text>
                    <Text style={styles.emptyStateHint}>Changes made by the agent will appear here.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryText}>
                            {summary.fileCount} {summary.fileCount === 1 ? "file" : "files"} changed
                        </Text>
                        <View style={styles.summaryStats}>
                            <Text style={styles.summaryAdded}>+{summary.totalAdditions}</Text>
                            <Text style={styles.summaryRemoved}>-{summary.totalDeletions}</Text>
                        </View>
                        <PressableScale onPress={allExpanded ? collapseAll : expandAll} hitSlop={8}>
                            <Text style={styles.expandCollapseText}>
                                {allExpanded ? "Collapse all" : "Expand all"}
                            </Text>
                        </PressableScale>
                    </View>
                    <View style={styles.fileList}>
                        <FlashList
                            data={diffs}
                            keyExtractor={(item: FileDiff) => item.file}
                            extraData={expandedFiles}
                            renderItem={({ item }: { item: FileDiff }) => (
                                <FileAccordionItem
                                    diff={item}
                                    isExpanded={expandedFiles.has(item.file)}
                                    onToggle={() => toggleFile(item.file)}
                                />
                            )}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={() => void onRefresh()}
                                    tintColor={palette.smoke[7]}
                                />
                            }
                        />
                    </View>
                </>
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
    skeletonCard: {
        height: 48,
        borderRadius: 8,
        backgroundColor: palette.smoke[3],
        marginBottom: 8,
        alignSelf: "stretch",
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
    emptyStateHint: {
        fontSize: 13,
        color: palette.smoke[6],
    },
    summaryRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    summaryText: {
        fontSize: 13,
        color: colors.text.weak,
    },
    summaryStats: {
        flexDirection: "row",
        gap: 6,
        flex: 1,
    },
    summaryAdded: {
        fontSize: 13,
        color: colors.diff.add,
        fontWeight: "500",
    },
    summaryRemoved: {
        fontSize: 13,
        color: colors.diff.delete,
        fontWeight: "500",
    },
    expandCollapseText: {
        fontSize: 13,
        color: palette.smoke[9],
        fontWeight: "500",
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
        flex: 1,
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
        width: 24,
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
