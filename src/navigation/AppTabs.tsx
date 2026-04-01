import React from "react"
import { View, Text, StyleSheet } from "react-native"
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
    <View style={offlineStyles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={palette.ember[9]} />
      <Text style={offlineStyles.text}>No connection</Text>
    </View>
  )
}

const offlineStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    backgroundColor: palette.ember[2],
  },
  text: {
    color: palette.ember[9],
    fontSize: 12,
    fontWeight: "500",
  },
})

export default function AppTabs() {
  return (
    <>
    <OfflineBanner />
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
        tabBarActiveTintColor: colors.interactive.active,
        tabBarInactiveTintColor: colors.interactive.base,
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
