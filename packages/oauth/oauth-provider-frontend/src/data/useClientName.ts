import { useLingui } from '@lingui/react/macro'
import {
  OAuthClientMetadata,
  isConventionalOAuthClientId,
  isOAuthClientIdLoopback,
} from '#/util/oauth-client'

export function useClientName({
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
