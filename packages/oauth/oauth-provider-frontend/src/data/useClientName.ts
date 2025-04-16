import { useLingui } from '@lingui/react/macro'
import type { OAuthClientMetadata } from '@atproto/oauth-types'

export function useClientName({
  clientId,
  clientMetadata,
  clientTrusted = false,
}: {
  clientId: string
  clientMetadata?: OAuthClientMetadata
  clientTrusted?: boolean
}): string {
  const { t } = useLingui()

  if (clientTrusted && clientMetadata?.client_name) {
    return clientMetadata.client_name
  }

  // @NOTE: not using isOAuthClientIdLoopback & isOAuthClientIdDiscoverable from
  // @atproto/oauth-types here because 1) we don't need to validate here and 2)
  // we prefer not to import un-necessary code to improve bundle size.

  if (clientId.startsWith('http://')) {
    return t`A local app`
  }

  if (clientId.startsWith('https://')) {
    try {
      const url = new URL(clientId)
      if (
        url.protocol === 'https:' &&
        url.pathname === '/oauth-client-metadata.json' &&
        !url.port &&
        !url.search
      ) {
        return url.hostname
      }
    } catch {
      // ignore
    }
  }

  return clientId
}
