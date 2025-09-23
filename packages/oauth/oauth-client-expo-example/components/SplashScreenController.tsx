import { SplashScreen } from 'expo-router'
import { useSession } from './SessionProvider'

export function SplashScreenController() {
  const { isLoading } = useSession()

  if (!isLoading) {
    SplashScreen.hideAsync()
  }

  return null
}
