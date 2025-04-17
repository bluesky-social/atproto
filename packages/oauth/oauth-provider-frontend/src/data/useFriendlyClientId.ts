import { useLingui } from '@lingui/react/macro'
import {
  isConventionalOAuthClientId,
  isOAuthClientIdLoopback,
} from '#/util/oauth-client'

export function useFriendlyClientId({
  clientId,
}: {
  clientId: string
}): string {
  const { t } = useLingui()

  if (isOAuthClientIdLoopback(clientId)) {
    return t`loopback`
  }

  if (isConventionalOAuthClientId(clientId)) {
    return new URL(clientId).hostname
  }

  // Should never happen
  return clientId
}
