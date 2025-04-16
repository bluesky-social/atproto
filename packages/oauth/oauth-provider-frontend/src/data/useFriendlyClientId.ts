import { useLingui } from '@lingui/react/macro'

export function useFriendlyClientId({
  clientId,
  clientTrusted = false,
}: {
  clientId: string
  clientTrusted?: boolean
}): string {
  const { t } = useLingui()

  if (clientId.startsWith('http://')) {
    return t`loopback`
  }

  if (clientId.startsWith('https://')) {
    try {
      const url = new URL(clientId)
      if (clientTrusted) {
        return url.hostname
      }
      if (url.pathname === '/oauth-client-metadata.json' && !url.port) {
        return url.hostname
      }
    } catch {
      // ignore
    }
  }

  return clientId
}
