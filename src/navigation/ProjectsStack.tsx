import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import ProjectsHomeScreen from "../screens/ProjectsHomeScreen"
import SessionsListScreen from "../screens/SessionsListScreen"
import SessionDetailScreen from "../screens/SessionDetailScreen"
import ReviewScreen from "../screens/ReviewScreen"
import ShareScreen from "../screens/ShareScreen"
import { colors } from "../constants/theme"

export type ProjectsStackParamList = {
  ProjectsHome: undefined
  SessionsList: undefined
  SessionDetail: { sessionId?: string } | undefined
  Review: { sessionId?: string } | undefined
  Share: { sessionId?: string } | undefined
}

const Stack = createNativeStackNavigator<ProjectsStackParamList>()

export default function ProjectsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.base,
        },
        headerTintColor: colors.text.base,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerShadowVisible: false, // Cleaner look
        contentStyle: {
          backgroundColor: colors.background.base,
        },
      }}
    >
      <Stack.Screen
        name="ProjectsHome"
        component={ProjectsHomeScreen}
        options={{ title: "Projects" }}
      />
      <Stack.Screen
        name="SessionsList"
        component={SessionsListScreen}
        options={{ title: "Sessions" }}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ title: "Session" }}
      />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Share" component={ShareScreen} />
    </Stack.Navigator>
  )
}
