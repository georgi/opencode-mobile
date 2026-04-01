import React, { useEffect, useRef, useState } from "react"
import {
    View,
    Text,
    StyleSheet,
    Switch,
    Share,
    ActivityIndicator,
} from "react-native"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"
import { colors, palette } from "../constants/theme"
import { Pressable } from "react-native"
import { PressableScale } from "../components/PressableScale"
import { ErrorBanner } from "../components/ErrorBanner"

export default function ShareScreen() {
    const route = useRoute<RouteProp<ProjectsStackParamList, "Share">>()
    const currentSession = useSessionStore((state) => state.currentSession)
    const shareSession = useSessionStore((state) => state.shareSession)
    const unshareSession = useSessionStore((state) => state.unshareSession)
    const sessionId = currentSession?.id ?? route.params?.sessionId
    const shareUrl = currentSession?.share?.url
    const isEnabled = Boolean(shareUrl)
    const [isToggling, setIsToggling] = useState(false)
    const [copied, setCopied] = useState(false)
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
        }
    }, [])

    const handleToggle = async (value: boolean) => {
        if (!sessionId || isToggling) {
            return
        }

        setIsToggling(true)
        try {
            if (value) {
                await shareSession(sessionId)
            } else {
                await unshareSession(sessionId)
            }
        } finally {
            setIsToggling(false)
        }
    }

    const handleCopy = async () => {
        if (!shareUrl) {
            return
        }

        await Clipboard.setStringAsync(shareUrl)
        setCopied(true)
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    }

    const handleShare = async () => {
        if (!shareUrl) {
            return
        }

        await Share.share({
            url: shareUrl,
            message: shareUrl,
        })
    }

    return (
        <View style={styles.container}>
            <View style={styles.headerSection}>
                <Ionicons name="link-outline" size={32} color={palette.smoke[7]} />
                <Text style={styles.title}>Share Session</Text>
                <Text style={styles.description}>
                    Anyone with the link can view this conversation.
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.rowLabel}>Sharing enabled</Text>
                        {isToggling && (
                            <ActivityIndicator size="small" color={palette.smoke[7]} style={{ marginTop: 4 }} />
                        )}
                    </View>
                    <Switch
                        value={isEnabled}
                        onValueChange={(value) => void handleToggle(value)}
                        disabled={isToggling}
                    />
                </View>
            </View>

            {shareUrl ? (
                <View style={styles.card}>
                    <Text style={styles.linkLabel}>Share link</Text>
                    <Text style={styles.linkUrl} numberOfLines={2} selectable>
                        {shareUrl}
                    </Text>
                    <View style={styles.buttonRow}>
                        <PressableScale style={styles.button} onPress={() => void handleCopy()}>
                            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={colors.text.invert} />
                            <Text style={styles.buttonText}>{copied ? "Copied!" : "Copy"}</Text>
                        </PressableScale>
                        <PressableScale style={styles.button} onPress={() => void handleShare()}>
                            <Ionicons name="share-outline" size={16} color={colors.text.invert} />
                            <Text style={styles.buttonText}>Share</Text>
                        </PressableScale>
                    </View>
                </View>
            ) : null}

            <ErrorBanner />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        gap: 16,
        backgroundColor: colors.background.base,
    },
    headerSection: {
        alignItems: "center",
        paddingVertical: 16,
        gap: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: "600",
        color: colors.text.base,
    },
    description: {
        fontSize: 14,
        color: colors.text.weak,
        textAlign: "center",
    },
    card: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: palette.smoke[2],
        gap: 10,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    rowLabel: {
        fontSize: 15,
        fontWeight: "500",
        color: colors.text.base,
    },
    linkLabel: {
        fontSize: 12,
        fontWeight: "500",
        color: palette.smoke[7],
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    linkUrl: {
        fontSize: 13,
        color: palette.smoke[9],
        fontFamily: "Menlo",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 8,
    },
    button: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: colors.interactive.base,
    },
    buttonText: {
        color: colors.text.invert,
        fontWeight: "600",
        fontSize: 14,
    },
})
