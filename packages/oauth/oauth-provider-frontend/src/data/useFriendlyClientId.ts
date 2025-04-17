import { useLingui } from '@lingui/react/macro'

export function useFriendlyClientId({
  clientId,
}: {
  clientId: string
}): string {
  const { t } = useLingui()

  if (clientId.startsWith('http://')) {
    return t`loopback`
  }

  if (clientId.startsWith('https://')) {
    try {
      const url = new URL(clientId)
      if (url.pathname === '/oauth-client-metadata.json' && !url.port) {
        return url.hostname
      }
    } catch {
      // ignore
    }
  }

  return clientId
}
