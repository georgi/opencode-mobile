import React, { useCallback, useEffect, useState } from "react"
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    RefreshControl,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import { colors, palette } from "../constants/theme"
import * as Haptics from "expo-haptics"

export default function NotificationsScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
    const pendingPermissions = useSessionStore((state) => state.pendingPermissions)
    const fetchPermissions = useSessionStore((state) => state.fetchPermissions)
    const respondToPermission = useSessionStore((state) => state.respondToPermission)
    const [refreshing, setRefreshing] = useState(false)
    const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        void fetchPermissions()
    }, [fetchPermissions])

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        await fetchPermissions()
        setRefreshing(false)
    }, [fetchPermissions])

    const handleRespond = async (id: string, reply: "once" | "always" | "reject") => {
        if (respondingIds.has(id)) return
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setRespondingIds((prev) => new Set(prev).add(id))
        try {
            await respondToPermission(id, reply)
        } finally {
            setRespondingIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        }
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void onRefresh()}
                    tintColor={palette.smoke[7]}
                />
            }
        >
            <View style={styles.headerRow}>
                {pendingPermissions.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                            {pendingPermissions.length}
                        </Text>
                    </View>
                )}
                <Pressable
                    onPress={() => void fetchPermissions()}
                    hitSlop={12}
                >
                    <Ionicons
                        name="refresh"
                        size={20}
                        color={palette.smoke[7]}
                    />
                </Pressable>
            </View>

            {pendingPermissions.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={48} color={palette.smoke[5]} style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyText}>No pending permissions</Text>
                    <Text style={styles.emptyHint}>Check back when a session needs approval.</Text>
                </View>
            ) : (
                pendingPermissions.map((permission) => (
                    <View key={permission.id} style={styles.permissionCard}>
                        <Text style={styles.permissionTitle}>
                            {permission.permission}
                        </Text>
                        <Text style={styles.permissionPatterns}>
                            {permission.patterns.join(", ")}
                        </Text>
                        <View style={styles.permissionActions}>
                            <Pressable
                                style={[styles.actionButton, respondingIds.has(permission.id) && { opacity: 0.5 }]}
                                onPress={() => void handleRespond(permission.id, "once")}
                                disabled={respondingIds.has(permission.id)}
                            >
                                <Text style={styles.actionButtonText}>Once</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.actionButton, respondingIds.has(permission.id) && { opacity: 0.5 }]}
                                onPress={() => void handleRespond(permission.id, "always")}
                                disabled={respondingIds.has(permission.id)}
                            >
                                <Text style={styles.actionButtonText}>Always</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.rejectButton, respondingIds.has(permission.id) && { opacity: 0.5 }]}
                                onPress={() => void handleRespond(permission.id, "reject")}
                                disabled={respondingIds.has(permission.id)}
                            >
                                <Text style={styles.rejectButtonText}>Reject</Text>
                            </Pressable>
                        </View>
                        <Pressable
                            onPress={() =>
                                navigation.navigate("SessionDetail", {
                                    sessionId: permission.sessionID,
                                })
                            }
                        >
                            <Text style={styles.openSessionText}>Open Session</Text>
                        </Pressable>
                    </View>
                ))
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.base,
    },
    contentContainer: {
        padding: 16,
        gap: 8,
        flexGrow: 1,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    badge: {
        backgroundColor: palette.smoke[3],
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 2,
    },
    badgeText: {
        color: palette.smoke[11],
        fontSize: 13,
        fontWeight: "600",
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: palette.smoke[7],
        fontSize: 14,
    },
    emptyHint: {
        color: palette.smoke[6],
        fontSize: 13,
        marginTop: 4,
    },
    permissionCard: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: palette.smoke[2],
        gap: 8,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text.base,
    },
    permissionPatterns: {
        color: colors.text.weak,
        fontSize: 13,
    },
    permissionActions: {
        flexDirection: "row",
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: palette.smoke[3],
        alignItems: "center",
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: "500",
        color: palette.smoke[10],
    },
    rejectButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: palette.ember[2],
        alignItems: "center",
    },
    rejectButtonText: {
        fontSize: 13,
        fontWeight: "500",
        color: palette.ember[9],
    },
    openSessionText: {
        color: palette.smoke[7],
        fontSize: 13,
    },
})
