import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { Ionicons } from "@expo/vector-icons"
import ProjectsStack from "./ProjectsStack"
import SessionsScreen from "../screens/SessionsScreen"
import NotificationsScreen from "../screens/NotificationsScreen"
import SettingsScreen from "../screens/SettingsScreen"
import { colors } from "../constants/theme"

export type AppTabParamList = {
  Projects: undefined
  Sessions: undefined
  Notifications: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<AppTabParamList>()

export default function AppTabs() {
  return (
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
          } else if (route.name === "Sessions") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline"
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
      <Tab.Screen name="Sessions" component={SessionsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
