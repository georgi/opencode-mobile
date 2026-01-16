import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Button,
  TextInput,
} from "react-native"
import { useRoute } from "@react-navigation/native"
import type { RouteProp } from "@react-navigation/native"
import * as Clipboard from "expo-clipboard"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"

export default function ShareScreen() {
  const route = useRoute<RouteProp<ProjectsStackParamList, "Share">>()
  const currentSession = useSessionStore((state) => state.currentSession)
  const shareSession = useSessionStore((state) => state.shareSession)
  const unshareSession = useSessionStore((state) => state.unshareSession)
  const lastError = useSessionStore((state) => state.lastError)
  const sessionId = currentSession?.id ?? route.params?.sessionId
  const shareUrl = currentSession?.share?.url
  const [isEnabled, setIsEnabled] = useState(Boolean(shareUrl))
  const [expirationDays, setExpirationDays] = useState("7")

  useEffect(() => {
    setIsEnabled(Boolean(shareUrl))
  }, [shareUrl])

  const handleToggle = async (value: boolean) => {
    setIsEnabled(value)
    if (!sessionId) {
      return
    }

    if (value) {
      await shareSession(sessionId)
    } else {
      await unshareSession(sessionId)
    }
  }

  const handleCopy = async () => {
    if (!shareUrl) {
      return
    }

    await Clipboard.setStringAsync(shareUrl)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Share Session</Text>
      <Text>Toggle sharing and copy the share link.</Text>
      <View style={styles.row}>
        <Text>Sharing enabled</Text>
        <Switch value={isEnabled} onValueChange={handleToggle} />
      </View>
      <Text style={styles.label}>Share Link</Text>
      <Text>{shareUrl ?? "Not shared yet"}</Text>
      <Button title="Copy Link" onPress={handleCopy} disabled={!shareUrl} />
      <Text style={styles.label}>Expires in (days)</Text>
      <TextInput
        style={styles.input}
        value={expirationDays}
        onChangeText={setExpirationDays}
        keyboardType="numeric"
      />
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  error: {
    color: "#D92D20",
    marginTop: 12,
  },
})
