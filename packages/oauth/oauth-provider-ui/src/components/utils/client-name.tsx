import { Trans } from '@lingui/react/macro'
import { JSX, useMemo } from 'react'
import {
  OAuthClientMetadata,
  isConventionalOAuthClientId,
} from '#/lib/oauth-client.ts'
import { Override } from '../../lib/util.ts'
import { UrlViewer } from './url-viewer.tsx'

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
    // Only display the url details if the client id does not follow our
    // convention.
    const simplifiedView = isConventionalOAuthClientId(clientId)

    return (
      <UrlViewer
        {...attrs}
        url={url}
        proto={!simplifiedView}
        host={true}
        path={!simplifiedView}
        query={!simplifiedView}
        hash={false}
      />
    )
  }

  return <span {...attrs}>{clientId}</span>
}
