import React, { useEffect, useRef } from "react"
import { Pressable, Text, StyleSheet } from "react-native"
import { useSessionStore } from "../store/sessionStore"
import { palette } from "../constants/theme"

const AUTO_DISMISS_MS = 5000

export function ErrorBanner() {
  const lastError = useSessionStore((state) => state.lastError)
  const errorSeq = useSessionStore((state) => state.errorSeq)
  const clearError = useSessionStore((state) => state.clearError)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastError) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => clearError(), AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [lastError, errorSeq])

  if (!lastError) return null

  return (
    <Pressable onPress={clearError} style={styles.errorBanner}>
      <Text style={styles.errorText}>{lastError}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  errorBanner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: palette.ember[2],
  },
  errorText: {
    color: palette.ember[9],
    fontSize: 13,
    textAlign: "center",
  },
})
