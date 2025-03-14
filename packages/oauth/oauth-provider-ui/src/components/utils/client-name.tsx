import { Trans } from '@lingui/react/macro'
import { JSX } from 'react'
import type { OAuthClientMetadata } from '@atproto/oauth-types'
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
  if (clientTrusted && clientMetadata.client_name) {
    return <span {...attrs}>{clientMetadata.client_name}</span>
  }

  // @NOTE: not using isOAuthClientIdLoopback & isOAuthClientIdDiscoverable from
  // @atproto/oauth-types here because 1) we don't need to validate here and 2)
  // we prefer not to import un-necessary code to improve bundle size.

  if (clientId.startsWith('http://')) {
    return (
      <span {...attrs}>
        <Trans>An application on your device</Trans>
      </span>
    )
  }

  if (clientId.startsWith('https://')) {
    return <UrlViewer {...attrs} url={clientId} path />
  }

  return <span {...attrs}>{clientId}</span>
}
