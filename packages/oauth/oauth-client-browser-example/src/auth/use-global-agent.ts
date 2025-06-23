import { useEffect } from 'react'
import { useAuthContext } from './auth-provider.tsx'

export function useGlobalAgent(propName = 'agent') {
  const auth = useAuthContext()

  // Expose agent globally
  const agent = auth.signedIn ? auth.agent : null
  useEffect(() => {
    if (!agent) return
    globalThis[propName] = agent
    return () => {
      if (globalThis[propName] === agent) {
        delete globalThis[propName]
      }
    }
  }, [propName, agent])
}
