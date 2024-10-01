import {
  isOAuthClientIdDiscoverable,
  isOAuthClientIdLoopback,
  OAuthClientMetadata,
} from '@atproto/oauth-types'
import { HTMLAttributes } from 'react'

import { UrlViewer } from './url-viewer'

export type ClientNameProps = {
  clientId: string
  clientMetadata: OAuthClientMetadata
  clientTrusted: boolean
} & HTMLAttributes<Element>

export function ClientName({
  clientId,
  clientMetadata,
  clientTrusted,
  ...attrs
}: ClientNameProps) {
  if (isOAuthClientIdLoopback(clientId)) {
    return <span {...attrs}>An application on your device</span>
  }

  if (isOAuthClientIdDiscoverable(clientId)) {
    if (clientTrusted && clientMetadata.client_name) {
      return (
        <span {...attrs}>
          {clientMetadata.client_name} (<UrlViewer url={clientId} path />)
        </span>
      )
    }

    return <UrlViewer {...attrs} url={clientId} path />
  }

  return (
    <span {...attrs}>
      {(clientTrusted && clientMetadata.client_name) || clientId}
    </span>
  )
}
