import React, { useEffect, useRef } from "react"
import { Pressable, Text, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSessionStore } from "../store/sessionStore"
import { palette } from "../constants/theme"

const AUTO_DISMISS_MS = 5000

// Errors that the user *must* acknowledge — auto-dismiss would let them slip by.
const STICKY_ERRORS = new Set([
  "ERR SERVER UNAVAILABLE",
  "ERR OFFLINE",
  "ERR PERMISSION REQUIRED",
])

const isSticky = (error: string) => STICKY_ERRORS.has(error)

export function ErrorBanner() {
  const lastError = useSessionStore((state) => state.lastError)
  const errorSeq = useSessionStore((state) => state.errorSeq)
  const clearError = useSessionStore((state) => state.clearError)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastError) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (isSticky(lastError)) return
    timerRef.current = setTimeout(() => clearError(), AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lastError, errorSeq, clearError])

  if (!lastError) return null

  return (
    <Pressable onPress={clearError} style={styles.errorBanner}>
      <View style={styles.row}>
        <Text style={styles.errorText} numberOfLines={2}>
          {lastError}
        </Text>
        <Pressable
          onPress={clearError}
          hitSlop={10}
          accessibilityLabel="Dismiss error"
          accessibilityRole="button"
          style={styles.dismiss}
        >
          <Ionicons name="close" size={14} color={palette.ember[9]} />
        </Pressable>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  errorBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.ember[2],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorText: {
    color: palette.ember[9],
    fontSize: 13,
    textAlign: "center",
    flexShrink: 1,
  },
  dismiss: {
    padding: 2,
  },
})
