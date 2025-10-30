import { useMemo } from 'react'
import { Agent } from '@atproto/api'
import { useOAuthSession } from '../providers/OAuthProvider.tsx'

export function useBskyClient() {
  const session = useOAuthSession()
  return useMemo(() => new Agent(session), [session])
}
