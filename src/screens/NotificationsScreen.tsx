import React, { useEffect } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import { colors, palette } from "../constants/theme"
import { Pressable } from "react-native"

export default function NotificationsScreen() {
    const navigation =
        useNavigation<NativeStackNavigationProp<ProjectsStackParamList>>()
    const pendingPermissions = useSessionStore((state) => state.pendingPermissions)
    const fetchPermissions = useSessionStore((state) => state.fetchPermissions)
    const respondToPermission = useSessionStore((state) => state.respondToPermission)

    useEffect(() => {
        void fetchPermissions()
    }, [fetchPermissions])

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={{ color: colors.text.base }}>Permission prompts and session updates.</Text>
            <Text style={styles.label}>Pending Permissions</Text>
            <Text style={{ color: colors.text.base }}>{pendingPermissions.length} requests</Text>
            <Pressable onPress={() => void fetchPermissions()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Refresh</Text>
            </Pressable>
            {pendingPermissions.map((permission) => (
                <View key={permission.id} style={styles.permissionCard}>
                    <Text style={styles.permissionTitle}>{permission.permission}</Text>
                    <Text style={{ color: colors.text.base }}>{permission.patterns.join(", ")}</Text>
                    <View style={styles.permissionActions}>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => void respondToPermission(permission.id, "once")}
                        >
                            <Text style={styles.actionButtonText}>Once</Text>
                        </Pressable>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => void respondToPermission(permission.id, "always")}
                        >
                            <Text style={styles.actionButtonText}>Always</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => void respondToPermission(permission.id, "reject")}
                        >
                            <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
                        </Pressable>
                    </View>
                    <Pressable
                        style={styles.primaryButton}
                        onPress={() =>
                            navigation.navigate("SessionDetail", {
                                sessionId: permission.sessionID,
                            })
                        }
                    >
                        <Text style={styles.primaryButtonText}>Open Session</Text>
                    </Pressable>
                </View>
            ))}
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
        fontSize: 20,
        fontWeight: "600",
        color: colors.text.base,
    },
    label: {
        fontSize: 14,
        fontWeight: "500",
        marginTop: 12,
        color: colors.text.weak,
    },
    permissionCard: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.surface.highlight,
        backgroundColor: colors.surface.base,
        gap: 8,
        marginTop: 8,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text.base,
    },
    permissionActions: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 8,
    },
    secondaryButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.surface.highlight,
        backgroundColor: colors.surface.base,
        alignSelf: "flex-start",
    },
    secondaryButtonText: {
        color: colors.text.base,
        fontSize: 14,
        fontWeight: "500",
    },
    primaryButton: {
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.interactive.base,
        alignItems: "center",
    },
    primaryButtonText: {
        color: colors.text.invert,
        fontWeight: "600",
    },
    actionButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.surface.highlight,
        backgroundColor: colors.background.base,
        alignItems: "center",
    },
    actionButtonText: {
        fontSize: 13,
        fontWeight: "500",
        color: colors.text.base,
    },
    rejectButton: {
        borderColor: palette.ember[3],
        backgroundColor: palette.ember[2],
    },
    rejectButtonText: {
        color: colors.status.error,
    },
})
