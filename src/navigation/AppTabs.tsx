import React from "react"
import { View, Text, StyleSheet, StatusBar } from "react-native"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import ProjectsStack from "./ProjectsStack"
import NotificationsScreen from "../screens/NotificationsScreen"
import SettingsScreen from "../screens/SettingsScreen"
import { useSessionStore } from "../store/sessionStore"
import { colors, palette } from "../constants/theme"

export type AppTabParamList = {
  Projects: undefined
  Notifications: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<AppTabParamList>()

function OfflineBanner() {
  const isOffline = useSessionStore((s) => s.isOffline)
  if (!isOffline) return null
  return (
    <View style={bannerStyles.error} accessibilityLabel="App is offline" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={palette.ember[9]} />
      <Text style={bannerStyles.errorText}>No connection</Text>
    </View>
  )
}

function ReconnectingBanner() {
  const isConnected = useSessionStore((s) => s.isEventSourceConnected)
  const eventSource = useSessionStore((s) => s.eventSource)
  const isOffline = useSessionStore((s) => s.isOffline)
  // Show reconnecting banner when we have no connection but aren't fully offline
  // and there's no active eventSource (meaning we're between reconnect attempts)
  if (isOffline || isConnected || eventSource) return null
  return (
    <View style={bannerStyles.warning} accessibilityLabel="Reconnecting to server" accessibilityRole="alert">
      <Ionicons name="sync-outline" size={16} color={palette.solaris[9]} />
      <Text style={bannerStyles.warningText}>Reconnecting...</Text>
    </View>
  )
}

const bannerStyles = StyleSheet.create({
  error: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: palette.ember[2],
  },
  errorText: {
    color: palette.ember[9],
    fontSize: 13,
    fontWeight: "500",
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: palette.solaris[2],
  },
  warningText: {
    color: palette.solaris[9],
    fontSize: 13,
    fontWeight: "500",
  },
})

const NotificationBadge = React.memo(function NotificationBadge() {
  const count = useSessionStore((s) => s.pendingPermissions.length)
  if (count === 0) return null
  return (
    <View style={badgeStyles.badge}>
      <Text style={badgeStyles.badgeText}>{count > 9 ? "9+" : count}</Text>
    </View>
  )
})

const badgeStyles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.ember[9],
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
})

export default function AppTabs() {
  return (
    <>
    <StatusBar barStyle="light-content" />
    <OfflineBanner />
    <ReconnectingBanner />
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.background.base,
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTintColor: colors.text.base,
        tabBarStyle: {
          backgroundColor: colors.background.base,
          borderTopColor: colors.surface.highlight,
          borderTopWidth: 1,
          height: 88, // Taller tab bar for modern look
          paddingTop: 8,
        },
        tabBarActiveTintColor: palette.lilac[9],
        tabBarInactiveTintColor: palette.smoke[7],
        tabBarLabelStyle: {
          fontWeight: "500",
          fontSize: 11,
          marginBottom: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "help"

          if (route.name === "Projects") {
            iconName = focused ? "folder" : "folder-outline"
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline"
          } else if (route.name === "Settings") {
            iconName = focused ? "settings" : "settings-outline"
          }

          // Adjust icon size for better proportion
          if (route.name === "Notifications") {
            return (
              <View>
                <Ionicons name={iconName} size={24} color={color} />
                <NotificationBadge />
              </View>
            )
          }
          return <Ionicons name={iconName} size={24} color={color} />
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectsStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
    </>
  )
}
