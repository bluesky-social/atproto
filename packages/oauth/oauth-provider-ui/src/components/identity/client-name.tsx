import { Trans } from '@lingui/react/macro'
import { type JSX, useMemo } from 'react'
import { UrlViewer } from '#/components/utils/url-viewer.tsx'
import type { OAuthClientMetadata } from '#/lib/oauth-client.ts'
import type { Override } from '#/lib/util.ts'

export type ClientNameProps = Override<
  Omit<JSX.IntrinsicElements['span'], 'children'>,
  {
    clientId: string
    clientMetadata: OAuthClientMetadata
    clientTrusted: boolean
  }
>

export function ClientName({
  clientId,
  clientMetadata,
  clientTrusted,

  // span
  ...attrs
}: ClientNameProps) {
  const url = useMemo(() => {
    try {
      return new URL(clientId)
    } catch {
      return null
    }
  }, [clientId])

  if (clientTrusted && clientMetadata.client_name) {
    return <span {...attrs}>{clientMetadata.client_name}</span>
  }

  // @NOTE: not using isOAuthClientIdLoopback & isOAuthClientIdDiscoverable from
  // @atproto/oauth-types here because 1) we don't need to validate here and 2)
  // we prefer not to import un-necessary code to improve bundle size.

  if (url?.protocol === 'http:') {
    return (
      <span {...attrs}>
        <Trans>An application on your device</Trans>
      </span>
    )
  }

  if (url?.protocol === 'https:') {
    // @NOTE Host only. The full client id is shown in the "Technical details"
    // dialog, so the card can name the app by its domain alone.
    return (
      <UrlViewer
        {...attrs}
        url={url}
        proto={false}
        host={true}
        path={false}
        query={false}
        hash={false}
      />
    )
  }

  return <span {...attrs}>{clientId}</span>
}
