import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { useSessionStore } from "../store/sessionStore"

export default function SessionsScreen() {
  const currentSession = useSessionStore((state) => state.currentSession)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sessions</Text>
      <Text>Quick access to recent sessions.</Text>
      <Text style={styles.label}>Current Session</Text>
      <Text>{currentSession?.title ?? "No session selected"}</Text>
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
})
