import React, { useEffect } from "react"
import { View, Text, StyleSheet, Button } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useSessionStore } from "../store/sessionStore"
import type { ProjectsStackParamList } from "../navigation/ProjectsStack"

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
      <Text>Permission prompts and session updates.</Text>
      <Text style={styles.label}>Pending Permissions</Text>
      <Text>{pendingPermissions.length} requests</Text>
      <Button title="Refresh" onPress={() => void fetchPermissions()} />
      {pendingPermissions.map((permission) => (
        <View key={permission.id} style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>{permission.permission}</Text>
          <Text>{permission.patterns.join(", ")}</Text>
          <View style={styles.permissionActions}>
            <Button
              title="Once"
              onPress={() => void respondToPermission(permission.id, "once")}
            />
            <Button
              title="Always"
              onPress={() => void respondToPermission(permission.id, "always")}
            />
            <Button
              title="Reject"
              onPress={() => void respondToPermission(permission.id, "reject")}
            />
          </View>
          <Button
            title="Open Session"
            onPress={() =>
              navigation.navigate("SessionDetail", {
                sessionId: permission.sessionID,
              })
            }
          />
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
  permissionCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E4E4E7",
    gap: 8,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  permissionActions: {
    flexDirection: "row",
    gap: 8,
  },
})
