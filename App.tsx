import React, { useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AppTabs from "./src/navigation/AppTabs"
import { useSessionStore } from "./src/store/sessionStore"

export default function App() {
  const client = useSessionStore((state) => state.client)
  const hydrateServers = useSessionStore((state) => state.hydrateServers)
  const subscribeToEvents = useSessionStore((state) => state.subscribeToEvents)

  useEffect(() => {
    void hydrateServers()
  }, [hydrateServers])

  useEffect(() => {
    if (!client) {
      return
    }

    void subscribeToEvents()
  }, [client, subscribeToEvents])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
