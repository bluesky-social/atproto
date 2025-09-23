import { BskyAgentProvider } from '@/components/BskyAgentProvider'
import { SessionProvider, useSession } from '@/components/SessionProvider'
import { SplashScreenController } from '@/components/SplashScreenController'
import { oauthClient } from '@/utils/oauthClient'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'

const queryClient = new QueryClient()

export default function Layout() {
  return (
    <SessionProvider client={oauthClient}>
      <QueryClientProvider client={queryClient}>
        <BskyAgentProvider>
          <RootNavigator />
          <SplashScreenController />
        </BskyAgentProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}

// Separate component so it can access the SessionProvider context
function RootNavigator() {
  const { isLoggedIn } = useSession()

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
