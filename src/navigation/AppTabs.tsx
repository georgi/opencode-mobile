import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import ProjectsStack from "./ProjectsStack"
import SessionsScreen from "../screens/SessionsScreen"
import NotificationsScreen from "../screens/NotificationsScreen"
import SettingsScreen from "../screens/SettingsScreen"

export type AppTabParamList = {
  Projects: undefined
  Sessions: undefined
  Notifications: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<AppTabParamList>()

export default function AppTabs() {
  return (
    <Tab.Navigator>
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
