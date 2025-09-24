import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SplashScreen, Stack } from 'expo-router'
import { BskyAgentProvider } from '@/components/BskyAgentProvider'
import { SessionProvider, useSession } from '@/components/SessionProvider'
import { oauthClient } from '@/utils/oauthClient'

const queryClient = new QueryClient()

export default function Layout() {
  return (
    <SessionProvider client={oauthClient}>
      <QueryClientProvider client={queryClient}>
        <BskyAgentProvider>
          <RootNavigator />
        </BskyAgentProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

// Separate component so it can access the SessionProvider context
function RootNavigator() {
  const { isLoading, isLoggedIn } = useSession()

  if (!isLoading) {
    SplashScreen.hideAsync()
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(authenticated)" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}
