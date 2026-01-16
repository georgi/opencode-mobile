import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import ProjectsHomeScreen from "../screens/ProjectsHomeScreen"
import SessionsListScreen from "../screens/SessionsListScreen"
import SessionDetailScreen from "../screens/SessionDetailScreen"
import ReviewScreen from "../screens/ReviewScreen"
import ShareScreen from "../screens/ShareScreen"

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
    <Stack.Navigator>
      <Stack.Screen name="ProjectsHome" component={ProjectsHomeScreen} />
      <Stack.Screen name="SessionsList" component={SessionsListScreen} />
      <Stack.Screen name="SessionDetail" component={SessionDetailScreen} />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen name="Share" component={ShareScreen} />
    </Stack.Navigator>
  )
}
