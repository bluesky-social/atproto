import { useMemo } from 'react'
import { Api } from '#/api/api'

export type * from '@atproto/oauth-provider-api'
export * from '#/api/api'
export * from '#/api/json-client'

export function useApi() {
  return useMemo(() => new Api(), [])
}
