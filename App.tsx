import React, { useEffect } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import * as Network from "expo-network"
import AppTabs from "./src/navigation/AppTabs"
import { useSessionStore } from "./src/store/sessionStore"

export default function App() {
  const client = useSessionStore((state) => state.client)
  const hydrateServers = useSessionStore((state) => state.hydrateServers)
  const subscribeToEvents = useSessionStore((state) => state.subscribeToEvents)
  const setOffline = useSessionStore((state) => state.setOffline)

  useEffect(() => {
    void hydrateServers()
  }, [hydrateServers])

  useEffect(() => {
    if (!client) {
      return
    }

    void subscribeToEvents()
  }, [client, subscribeToEvents])

  useEffect(() => {
    let cancelled = false

    // Seed initial state so the offline banner reflects reality before the
    // first listener event fires.
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (cancelled) return
        setOffline(!(state.isConnected && state.isInternetReachable !== false))
      })
      .catch(() => {
        /* Treat probe errors as inconclusive — keep current value. */
      })

    const subscription = Network.addNetworkStateListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false))
    })

    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [setOffline])

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
