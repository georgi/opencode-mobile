import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { useSessionStore } from "../store/sessionStore"

export default function SettingsScreen() {
  const currentServer = useSessionStore((state) => state.currentServer)
  const isOffline = useSessionStore((state) => state.isOffline)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text>Server status and configuration controls.</Text>
      <Text style={styles.label}>Server</Text>
      <Text>{currentServer?.label ?? "No server selected"}</Text>
      <Text style={styles.label}>Status</Text>
      <Text>{isOffline ? "Offline" : "Online"}</Text>
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
