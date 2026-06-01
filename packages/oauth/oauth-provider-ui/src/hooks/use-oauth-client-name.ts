import { useLingui } from '@lingui/react/macro'
import {
  type OAuthClientMetadata,
  isConventionalOAuthClientId,
  isOAuthClientIdLoopback,
} from '@atproto/oauth-types'

export function useOauthClientName({
  clientId,
  clientMetadata,
}: {
  clientId: string
  clientMetadata?: OAuthClientMetadata
}): string {
  const { t } = useLingui()

  if (isOAuthClientIdLoopback(clientId)) {
    return t`A local app`
  }

  if (clientMetadata?.client_name) {
    return clientMetadata.client_name
  }

  if (isConventionalOAuthClientId(clientId)) {
    return new URL(clientId).hostname
  }

  // Should never happen
  return clientId
}
