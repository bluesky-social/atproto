import { ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Handle, sanitizeHandle } from './handle.tsx'

export function getAccountHandle(account?: Account): string | undefined {
  return sanitizeHandle(account?.preferred_username)
}

export function AccountHandle({ account }: { account?: Account }): ReactNode {
  const handle = account?.preferred_username
  if (!handle) return undefined
  return <Handle handle={handle} />
}
