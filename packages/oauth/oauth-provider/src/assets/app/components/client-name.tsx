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
  loopbackClientName?: string
} & HTMLAttributes<Element>

export function ClientName({
  clientId,
  clientMetadata,
  clientTrusted,
  loopbackClientName = 'An application on your device',
  ...attrs
}: ClientNameProps) {
  if (clientTrusted && clientMetadata.client_name) {
    return <span {...attrs}>{clientMetadata.client_name}</span>
  }

  if (isOAuthClientIdLoopback(clientId)) {
    return <span {...attrs}>{loopbackClientName}</span>
  }

  if (isOAuthClientIdDiscoverable(clientId)) {
    return <UrlViewer {...attrs} url={clientId} path />
  }

  return <span {...attrs}>{clientId}</span>
}
